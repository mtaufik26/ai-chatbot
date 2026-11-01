import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, DEFAULT_PERSONA, resolvePersona } from './personas.js';

// __dirname versi ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'];
const ACTIVE_PERSONA = resolvePersona(process.env.PERSONA) || DEFAULT_PERSONA;

// Batas supaya request tidak membengkak dan respon tetap cepat
const MAX_TURNS = 14;          // 7 giliran percakapan terakhir yang dikirim ke Gemini
const MAX_TEXT_LENGTH = 10000; // panjang maksimal satu pesan

// Cegah proses crash saat socket diputus klien (Esc / Hentikan respons)
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ERR_STREAM_WRITE_AFTER_END') {
    return;
  }
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[WARN] GEMINI_API_KEY belum diisi. Buat file .env dulu (lihat .env.example).');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || 'missing-key',
  // GEMINI_BASE_URL hanya dipakai untuk pengujian lokal (mock server)
  ...(process.env.GEMINI_BASE_URL && { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } }),
});

const app = express();
app.use(cors());
// Tingkatkan limit body json agar dapat menerima data file dalam format base64
app.use(express.json({ limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  },
}));

// MIME types yang didukung Gemini (gambar, audio, video, dokumen)
const SUPPORTED_MIME_PREFIXES = ['image/', 'audio/', 'video/'];
const SUPPORTED_EXACT_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'text/xml',
]);

function normalizeMimeType(mimeType, fileName = '') {
  if (!mimeType || mimeType === 'application/octet-stream') {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      mp3: 'audio/mp3',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/m4a',
      aac: 'audio/aac',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };
    if (ext && map[ext]) return map[ext];
  }
  if (mimeType === 'audio/x-m4a' || mimeType === 'audio/mp4') return 'audio/m4a';
  if (mimeType === 'text/x-markdown') return 'text/markdown';
  return mimeType;
}

function isSupportedMime(mime) {
  if (!mime) return false;
  return SUPPORTED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || SUPPORTED_EXACT_MIMES.has(mime);
}

// Validasi + rapikan riwayat percakapan dari client.
// Format: [{ role: 'user' | 'model', text: '...', file?: { data, mimeType, name, size } }, ...]
function buildContents(conversation) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    throw badRequest('"conversation" harus berupa array dan tidak boleh kosong.');
  }

  // Ambil N pesan terakhir, lalu pastikan diawali "user" (syarat Gemini)
  let trimmed = conversation.slice(-MAX_TURNS);
  while (trimmed.length && trimmed[0]?.role !== 'user') trimmed = trimmed.slice(1);

  if (!trimmed.length || trimmed[trimmed.length - 1]?.role !== 'user') {
    throw badRequest('Pesan terakhir di "conversation" harus dari role "user".');
  }

  const lastUserIndex = trimmed.length - 1;

  return trimmed.map((msg, i) => {
    if (!msg || typeof msg !== 'object') throw badRequest(`conversation[${i}] harus berupa object.`);
    const { role, text, file } = msg;
    if (role !== 'user' && role !== 'model') {
      throw badRequest(`conversation[${i}].role harus "user" atau "model".`);
    }

    const parts = [];

    // Sertakan data file inline untuk pesan user yang relevan
    if (file && role === 'user') {
      // Pertahankan data file untuk 2 turn user terbaru agar efisien dalam memory & token
      const isRecent = i >= lastUserIndex - 2;
      if (isRecent && file.data) {
        const mimeType = normalizeMimeType(file.mimeType, file.name);
        if (!isSupportedMime(mimeType)) {
          throw badRequest(
            `Format file "${file.name || mimeType}" belum didukung. Format yang didukung: Dokumen (PDF, TXT, MD, CSV, JSON), Foto (PNG, JPG, WEBP, GIF), Audio (MP3, WAV, M4A, OGG), Video (MP4, WEBM, MOV).`
          );
        }
        parts.push({
          inlineData: {
            mimeType,
            data: file.data,
          },
        });
      } else if (file.name) {
        // Turn lama yang lampiran datanya sudah dipangkas
        parts.push({ text: `[Pengguna sebelumnya melampirkan file: ${file.name}]` });
      }
    }

    // Teks pesan
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (trimmedText) {
      if (trimmedText.length > MAX_TEXT_LENGTH) {
        throw badRequest(`conversation[${i}].text maksimal ${MAX_TEXT_LENGTH} karakter.`);
      }
      parts.push({ text: trimmedText });
    } else if (parts.length > 0) {
      // Jika user hanya mengirim file tanpa instruksi teks
      parts.push({ text: 'Tolong analisis dan jelaskan isi file ini secara mendalam.' });
    } else {
      throw badRequest(`conversation[${i}] harus berupa string teks atau menyertakan file.`);
    }

    return { role, parts };
  });
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Daftar persona untuk dropdown di UI
app.get('/api/personas', (_req, res) => {
  const personas = Object.entries(PERSONAS).map(([id, p]) => ({
    id,
    label: p.label,
    greeting: p.greeting,
  }));
  res.json({ default: ACTIVE_PERSONA, personas });
});

// Cek server hidup
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: GEMINI_MODEL, keyConfigured: Boolean(apiKey) });
});

// Handler untuk GET /api/chat
// Mencegah error "Cannot GET /api/chat" jika URL dibuka langsung di browser
app.get('/api/chat', (req, res) => {
  if (req.accepts('html')) {
    return res.redirect('/');
  }
  res.status(405).json({
    error: 'Method Not Allowed. Endpoint /api/chat hanya menerima request POST dengan data JSON.',
    hint: `Buka http://localhost:${PORT}/ di browser untuk menggunakan antarmuka chat, atau kirimkan POST request ke endpoint ini.`,
  });
});

// Endpoint utama chatbot (multi-turn)
// Body:    { conversation: [{ role, text }], persona?: 'edukasi' }
// Respons: { result: '<jawaban Gemini>' }
app.post('/api/chat', async (req, res) => {
  const isStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

  try {
    const { conversation, persona } = req.body ?? {};

    if (persona !== undefined && !resolvePersona(persona)) {
      throw badRequest(`Persona "${persona}" tidak dikenal. Pilihan: ${Object.keys(PERSONAS).join(', ')}.`);
    }
    const selected = PERSONAS[persona ?? ACTIVE_PERSONA];

    const contents = buildContents(conversation);

    // Deteksi jika klien menghentikan respons (fitur Stop) atau menutup tab sebelum response selesai
    let clientDisconnected = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    // Daftar model prioritas dengan fallback otomatis jika terjadi kuota habis
    const modelToUse = GEMINI_MODEL;
    const candidateModels = [modelToUse, ...FALLBACK_MODELS.filter((m) => m !== modelToUse)];

    // 1. Jalur Streaming (Server-Sent Events) untuk respon instan tanpa jeda
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      let hasSentTokens = false;

      try {
        let stream = null;
        let lastErr = null;

        for (const candidate of candidateModels) {
          try {
            stream = await ai.models.generateContentStream({
              model: candidate,
              contents,
              config: {
                systemInstruction: selected.systemInstruction,
                ...selected.config,
              },
            });
            break;
          } catch (err) {
            lastErr = err;
            if (err.status === 429 || err.status === 503 || (err.message && err.message.includes('429'))) {
              console.warn(`[Model ${candidate}] kuota tercapai, mencoba fallback model berikutnya...`);
              continue;
            }
            throw err;
          }
        }

        if (!stream) {
          throw lastErr || new Error('Semua model Gemini sedang mencapai batas kuota.');
        }

        for await (const chunk of stream) {
          if (clientDisconnected || res.writableEnded) break;
          const chunkText = chunk.text;
          if (chunkText) {
            hasSentTokens = true;
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
          }
        }

        if (clientDisconnected || res.writableEnded) {
          if (!res.writableEnded) res.end();
          return;
        }

        res.write('data: [DONE]\n\n');
        res.end();
        return;
      } catch (err) {
        if (clientDisconnected || res.writableEnded) {
          if (!res.writableEnded) res.end();
          return;
        }

        if (hasSentTokens) {
          res.write(`data: ${JSON.stringify({ error: err.message || 'Streaming terputus.' })}\n\n`);
          res.end();
          return;
        }

        const status = err.status || 500;
        let errMsg = err.message || 'Gagal menghasilkan respons AI.';
        if (status === 429) {
          errMsg = 'Batas kuota request tercapai pada seluruh model. Mohon tunggu beberapa saat lalu coba lagi.';
        } else if (status === 503) {
          errMsg = 'Layanan Gemini sedang sibuk. Silakan coba kembali sesaat lagi.';
        }
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
        return;
      }
    }

    // 2. Jalur Non-streaming standar (JSON)
    let response = null;
    let lastErr = null;

    for (const candidate of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: candidate,
          contents,
          config: {
            systemInstruction: selected.systemInstruction,
            ...selected.config,
          },
        });
        break;
      } catch (err) {
        lastErr = err;
        if (err.status === 429 || err.status === 503 || (err.message && err.message.includes('429'))) {
          console.warn(`[Model ${candidate}] kuota tercapai, mencoba fallback model berikutnya...`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastErr || new Error('Semua model Gemini sedang mencapai batas kuota.');
    }

    const text = response.text;
    if (!text) {
      return res.status(502).json({ error: 'AI tidak mengembalikan teks. Coba ubah pertanyaanmu.' });
    }

    res.status(200).json({ result: text });
  } catch (e) {
    let status = Number.isInteger(e.status) && e.status >= 400 && e.status < 600 ? e.status : 500;
    let parsedMessage = e.message || 'Terjadi kesalahan pada server.';

    // Parse pesan error jika Google GenAI mengembalikan string JSON
    try {
      if (typeof e.message === 'string' && e.message.trim().startsWith('{')) {
        const parsed = JSON.parse(e.message);
        if (parsed.error) {
          if (parsed.error.code && Number.isInteger(parsed.error.code)) {
            status = parsed.error.code;
          }
          if (parsed.error.message) {
            parsedMessage = parsed.error.message;
          }
        }
      }
    } catch {
      // Abaikan jika bukan JSON valid
    }

    if (status >= 500 || status === 429) console.error('[chat error]', e);

    const isKeyError =
      status === 401 ||
      status === 403 ||
      (typeof parsedMessage === 'string' && (
        parsedMessage.includes('API key not valid') ||
        parsedMessage.includes('API_KEY_INVALID') ||
        parsedMessage.includes('API key expired')
      ));

    let message = parsedMessage;
    if (status === 429) {
      message = 'Kuota atau rate limit layanan AI tercapai. Tunggu sebentar lalu coba lagi.';
    } else if (isKeyError) {
      message = 'API key AI tidak valid atau belum diisi dengan benar. Pastikan API key di file .env sudah tepat dan server telah di-restart.';
    } else if (status === 503) {
      message = 'Layanan AI sedang mengalami lonjakan antrean/trafik. Silakan coba lagi beberapa saat lagi.';
    } else if (status === 404 && parsedMessage.includes('models/')) {
      message = `Model AI "${GEMINI_MODEL}" tidak tersedia atau sudah kedaluwarsa. Periksa konfigurasi model di file .env.`;
    }

    res.status(status).json({ error: message });
  }
});

// Error handler terakhir (mis. JSON body rusak)
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 400 ? 'Body request bukan JSON yang valid.' : err.message });
});

app.listen(PORT, () => {
  console.log(`ChatBot AI Server running on http://localhost:${PORT}`);
  console.log(`Model: ${GEMINI_MODEL} | Persona default: ${ACTIVE_PERSONA}`);
});
