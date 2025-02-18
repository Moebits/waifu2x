import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const progress = (current: number, total: number) => {
        console.log(`${current}/${total}`)
    }
    const result = await waifu2x.upscaleGIF("./images/gifs/chibi.gif", "./images/gifs/chibi2x.gif", {upscaler: "real-cugan", scale: 1})
    console.log(result)
}
start()