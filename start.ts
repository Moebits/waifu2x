import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const progress = (current: number, total: number) => {
        console.log(`${current}/${total}`)
    }
    const result = await waifu2x.upscalePDF("./images/pdfs/pdf.pdf", "./images/pdfs/pdf2x.pdf", {scale: 2, upscaler: "real-cugan", downscaleHeight: 1000}, progress)
    console.log(result)
}
start()