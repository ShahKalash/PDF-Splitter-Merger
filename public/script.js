document.getElementById("pdfFiles").addEventListener("change", function (e) {
    const files = e.target.files;
    const previewContainer = document.getElementById("pdf-preview");
    previewContainer.innerHTML = "";

    Array.from(files).forEach((file, fileIndex) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const typedarray = new Uint8Array(this.result);

            pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    pdf.getPage(pageNum).then(page => {
                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d");
                        const viewport = page.getViewport({ scale: 0.5 });
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        page.render(renderContext);

                        canvas.addEventListener("click", () => {
                            canvas.classList.toggle("border-4");
                            canvas.classList.toggle("border-blue-500");

                            const selected = JSON.parse(document.getElementById("selectedPages").value || "[]");
                            if (!selected[fileIndex]) selected[fileIndex] = [];

                            const pageIndex = page.pageNumber - 1;
                            const pageArray = selected[fileIndex];

                            const index = pageArray.indexOf(pageIndex);
                            if (index > -1) {
                                pageArray.splice(index, 1);
                            } else {
                                pageArray.push(pageIndex);
                            }

                            document.getElementById("selectedPages").value = JSON.stringify(selected);
                        });

                        previewContainer.appendChild(canvas);
                    });
                }
            });
        };
        fileReader.readAsArrayBuffer(file);
    });
});

document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) throw new Error("Failed to merge PDFs.");

        const data = await response.json();
        const base64Pdf = data.base64Pdf;
        const blob = new Blob([Uint8Array.from(atob(base64Pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        document.getElementById("previewFrame").src = url;
        document.getElementById("downloadLink").href = url;
        document.getElementById("downloadLink").download = "merged.pdf";

        document.getElementById("result").classList.remove("hidden");
    } catch (error) {
        alert("An error occurred: " + error.message);
    }
});