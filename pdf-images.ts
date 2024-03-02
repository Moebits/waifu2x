import {createCanvas, loadImage} from "canvas"
import fs from "fs"

const pdfjs = require("pdfjs-dist/build/pdf.js")

const renderPage = async (pdfDocument: any, pageNumber: number, options?: any) => {
    const page = await pdfDocument.getPage(pageNumber)
    let viewport = page.getViewport({scale: 1.0})
    let newScale = 1.0
    if (options.width) {
        newScale = options.width / viewport.width
    } else if (options.height) {
        newScale = options.height / viewport.height
    }
    if (newScale != 1 && newScale > 0) {
        viewport = page.getViewport({scale: newScale})
    }

    const canvas = createCanvas(viewport.width, viewport.height)
    const ctx = canvas.getContext("2d")

    const canvasFactory = {
        create: (width: number, height: number) => {
            const canvas = createCanvas(width, height)
            const context = canvas.getContext("2d")
            return {canvas, context}
        },
        reset: (ctx: any, width: number, height: number) => {
            ctx.canvas.width = width
            ctx.canvas.height = height
        },
        destroy: (ctx: any) => {
            ctx.canvas.width = 0
            ctx.canvas.height = 0
            ctx.canvas = null
            ctx.context = null
        }
    }

    await page.render({canvasContext: ctx, viewport, canvasFactory}).promise

    let mime = "image/jpeg" as any
    if (options.type === "png") mime = "image/png"
    if (options.type === "webp") mime = "image/webp"
    if (options.type === "avif") mime = "image/avif"

    return ctx.canvas.toBuffer(mime)
}

export const pdfImages = async (pdf: string | Buffer | Uint8Array, options?: {width?: number, height?: number, base64?: boolean, pageNumbers?: number[], type?: "jpg" | "png" | "webp" | "avif"}) => {
    if (!options) options = {}
    let pdfData = null as any
    if (typeof pdf === "string") {
        if (pdf.startsWith("http") || pdf.startsWith("file://")) {
            const arrayBuffer = await fetch(pdf).then((r) => r.arrayBuffer())
            pdfData = new Uint8Array(arrayBuffer)
        } else if (pdf.includes("base64")) {
            pdfData = new Uint8Array(Buffer.from(pdf.split(",")[1], "base64"));
        } else {
            pdfData = new Uint8Array(fs.readFileSync(pdf))
        }
    } else if (Buffer.isBuffer(pdf)) {
        pdfData = new Uint8Array(pdf)
    } else {
        pdfData = pdf
    }

    const pdfDocument = await pdfjs.getDocument({data: pdfData, disableFontFace: true, verbosity: 0}).promise 

    let outPages = []
    if (options.pageNumbers) {
        for (let i = 0; i < options.pageNumbers.length; i++) {
            let currentPage = await renderPage(pdfDocument, options.pageNumbers[i], options)
            if (currentPage) {
              if (options.base64) {
                outPages.push(currentPage.toString("base64"))
              } else {
                outPages.push(new Uint8Array(currentPage))
              }
            }
        }
    } else {
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            let currentPage = await renderPage(pdfDocument, i, options)
            if (currentPage) {
              if (options.base64) {
                outPages.push(currentPage.toString("base64"))
              } else {
                outPages.push(new Uint8Array(currentPage))
              }
            }
        }
    }

    return outPages
}