
export const getImageBrightness = (imageSrc: string): Promise<number> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(0);
                return;
            }

            // We only care about the top part where the header is
            // Header is usually 64px high. Let's sample top 100px.
            const sampleHeight = Math.min(img.height, 100);
            
            canvas.width = 1;
            canvas.height = 1;

            // Draw the top area resized to 1x1 pixel to get average
            // Source: x=0, y=0, w=img.width, h=sampleHeight
            // Dest: x=0, y=0, w=1, h=1
            ctx.drawImage(img, 0, 0, img.width, sampleHeight, 0, 0, 1, 1);

            const imageData = ctx.getImageData(0, 0, 1, 1);
            const data = imageData.data;
            const r = data[0];
            const g = data[1];
            const b = data[2];

            // Standard luminance formula
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            resolve(brightness);
        };

        img.onerror = () => {
            resolve(0); // Default to dark (so we use light text)
        };
    });
};
