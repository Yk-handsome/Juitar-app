import * as pdfjsLib from './pdfjs/pdf.min.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href
window.pdfjsReady = Promise.resolve(pdfjsLib)
window.dispatchEvent(new Event('pdfjs-ready'))
