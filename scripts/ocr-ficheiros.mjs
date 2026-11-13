/*
  Os ficheiros do leitor de texto das digitalizações (OCR em português, tesseract.js), servidos pela própria
  aplicação do Pessoal em ocr/: funciona sem internet. Vêm de node_modules no build (preparar-pessoal.mjs) e,
  em desenvolvimento, o Vite serve-os em /pessoal/ocr/. Não vão para o git nem para o GitHub Pages.
*/
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules')
// nome publicado -> origem
export const OCR = {
  'worker.min.js': path.join(NM, 'tesseract.js', 'dist', 'worker.min.js'),
  'tesseract-core-lstm.wasm.js': path.join(NM, 'tesseract.js-core', 'tesseract-core-lstm.wasm.js'),
  'tesseract-core-simd-lstm.wasm.js': path.join(NM, 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'),
  'tesseract-core-relaxedsimd-lstm.wasm.js': path.join(NM, 'tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'),
  'por.traineddata.gz': path.join(NM, '@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz'),
}
