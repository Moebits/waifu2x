import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const progress = (current: number, total: number) => {
        console.log(`${current}/${total}`)
    }
    //const result = await waifu2x.upscalePDF("./images/pdfs/pdf.pdf", "./images/pdfs/pdf2.pdf", {downscaleHeight: 1000})
    const result = await waifu2x.upscaleImage("./images/img.png", "./images/upscale/img2x.png", {upscaler: "real-esrgan", scale: 4})
    console.log(result)
}
start()