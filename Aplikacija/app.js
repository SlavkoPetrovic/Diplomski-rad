const express = require('express');
const multer = require('multer');
const fs = require('fs');
const weaviate = require('weaviate-client');

const app = express();
const upload = multer({ dest: 'uploads/' });
const COLLECTION_NAME = "DiplomskiRadCollection";

const client = weaviate.client({
    scheme: 'http',
    host: 'localhost:8080',
});

const loadStyle = () => {
    return fs.readFileSync('style.css', 'utf8');
};

const generateSearchForm = () => {
    return `
    <html>
    <head>
        <title>Diplomski rad</title>
        <style>${loadStyle()}</style>
    </head>
    <body>
        <h1>Diplomski rad - Primena vektorskih baza podataka</h1>
        
        <p>Pretraživanje po sličnosti</p>
        <p>CLIP model podržava pretraživanje po sličnosti reči kao i slika</p>
        <h2>Unesite tekst ili izaberite sliku</h2>
        <form id="searchForm" action="/search" method="post" enctype="multipart/form-data" onsubmit="return validateForm()">
            <textarea name="searchText" id="searchText" placeholder="Unesite tekst pretrage"></textarea><br>
            <div class="file-input-container">
                <div class="custom-file-input-container">
                    <input type="file" name="image" id="fileInput" accept="image/*" style="display: none;">
                    <label for="fileInput" class="custom-file-input">Izaberite sliku</label>
                    <button type="button" onclick="deselectImage()">X</button>
                </div>
            </div>
            <button type="submit">Pretraga</button>
        </form>
        <script>
            function deselectImage() {
                const fileInput = document.getElementById('fileInput');
                fileInput.value = ''; // Clear the selected file
                fileInput.nextElementSibling.textContent = 'Izaberite sliku'; // Reset the label text
            }
        
            document.getElementById('fileInput').addEventListener('change', function() {
                const files = this.files;
                if (files.length > 0) {
                    const fileName = files[0].name;
                    this.nextElementSibling.textContent = fileName;
                }
            });

            function validateForm() {
                const searchText = document.getElementById('searchText').value;
                const fileInput = document.getElementById('fileInput');
                
                if (searchText.trim() === '' && fileInput.value.trim() === '') {
                    alert('Unesite sliku ili tekst.');
                    return false; // Prevent form submission
                }

                return true; // Allow form submission
            }
        </script>
    </body>
    </html>
    `;
};


// Generate HTML content for image search results
const generateImageSearchResults = (distances, fullImagesPath) => {
    const style = loadStyle();
    const combinedData = fullImagesPath.map((imagePath, index) => ({
        imagePath,
        distance: distances[index]
    }));

    let htmlContent = `
    <html>
    <head>
        <title>Images</title> 
        <style>${style}</style>
    </head>
    <body>
        <div class="container">
    `;

    combinedData.forEach(data => {
        htmlContent += `
        <div class="image-container">
            <p>Distance: ${data.distance}</p>
            <img src="${data.imagePath}">
        </div>`;
    });

    htmlContent += `
        </div>
    </body>
    </html>
    `;

    return htmlContent;
};

app.use(express.static('data/images'));

app.get('/', (req, res) => {
    res.send(generateSearchForm());
});

app.post('/search', upload.single('image'), async (req, res) => {
    const searchText = req.body.searchText;
    const image = req.file;

    if (image) {
        const imgData = fs.readFileSync(image.path).toString('base64');
        const response = await client.graphql.get()
            .withClassName(COLLECTION_NAME)
            .withNearImage({ image: imgData })
            .withFields(['filename _additional { distance }'])
            .withLimit(6)
            .do();
        const distances = response.data.Get.DiplomskiRadCollection.map(item => item._additional.distance);
        const fullImagesPath = response.data.Get.DiplomskiRadCollection.map(item => item.filename);
        res.send(generateImageSearchResults(distances, fullImagesPath));
    } else {
        const response = await client.graphql.get()
            .withClassName(COLLECTION_NAME)
            .withNearText({ concepts: [searchText] })
            .withFields(['filename _additional { distance }'])
            .withLimit(6)
            .do();
        const distances = response.data.Get.DiplomskiRadCollection.map(item => item._additional.distance);
        const fullImagesPath = response.data.Get.DiplomskiRadCollection.map(item => item.filename);
        res.send(generateImageSearchResults(distances, fullImagesPath));
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
