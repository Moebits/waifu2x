import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const result = await waifu2x.upscaleGIF("F:/Downloads/kannaGIF.gif", "F:/Downloads/unnamed2x.gif", {scale: 1, cumulative: false})
    console.log(result)
})()
