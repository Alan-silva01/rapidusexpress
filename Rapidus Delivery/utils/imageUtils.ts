
/**
 * Utility to crop an image to a square and resize it.
 * @param file The original file from input
 * @param size The target size (size x size)
 * @returns A promise that resolves to a Blob
 */
export const cropToSquare = (file: File, size: number = 400): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context could not be created'));

                // Calculate crop
                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = img.width;
                let sourceHeight = img.height;

                if (img.width > img.height) {
                    sourceWidth = img.height;
                    sourceX = (img.width - img.height) / 2;
                } else {
                    sourceHeight = img.width;
                    sourceY = (img.height - img.width) / 2;
                }

                ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                }, 'image/jpeg', 0.9);
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(file);
    });
};
