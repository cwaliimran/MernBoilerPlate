const fs = require('fs');
const path = require('path');

// Define the directory path for the controllers and output file
const controllersDir = path.join(__dirname, 'controllers');
const outputFilePath = path.join(__dirname, 'translations.json');

// Load existing translations from the JSON file, or initialize an empty object if the file doesn't exist
let translations = {};
if (fs.existsSync(outputFilePath)) {
    translations = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
}

// Helper function to generate short and meaningful keys
const generateTranslationKey = (message) => {
    const words = message.toLowerCase().split(' ');
    const key = words.slice(0, 2).join('_').replace(/[^\w_]/g, '');
    return key.length > 20 ? key.slice(0, 20) : key;
};

// Read all files from the controllers folder
const processFiles = () => {
    const files = fs.readdirSync(controllersDir);

    files.forEach(file => {
        const filePath = path.join(controllersDir, file);

        if (fs.lstatSync(filePath).isFile() && file.endsWith('.js')) {
            let fileContent = fs.readFileSync(filePath, 'utf8');

            // Use regex to find translationKey values
            const regex = /translationKey:\s*"(.*?)"/g;
            let match;
            let modified = false;

            while ((match = regex.exec(fileContent)) !== null) {
                const translationValue = match[1];

                // Check if the translation value already exists in translations
                let existingKey = Object.keys(translations).find(key => translations[key] === translationValue);

                if (existingKey) {
                    // If the key already exists, replace the translationKey with the existing key
                    fileContent = fileContent.replace(`translationKey: "${translationValue}"`, `translationKey: "${existingKey}"`);
                    modified = true;
                } else {
                    // If the translation value does not exist, generate a new key
                    const generatedKey = generateTranslationKey(translationValue);

                    // Ensure the generated key is unique
                    let uniqueKey = generatedKey;
                    let i = 1;
                    while (translations[uniqueKey]) {
                        uniqueKey = `${generatedKey}_${i++}`;
                    }

                    // Add the new translation key to the translations object
                    translations[uniqueKey] = translationValue;

                    // Replace the translationKey in the file content with the new key
                    fileContent = fileContent.replace(`translationKey: "${translationValue}"`, `translationKey: "${uniqueKey}"`);
                    modified = true;
                }
            }

            // If the file was modified, write the updated content back to the file
            if (modified) {
                fs.writeFileSync(filePath, fileContent, 'utf8');
                console.log(`Updated file: ${file}`);
            }
        }
    });

    // Write the updated translations to the JSON file
    fs.writeFileSync(outputFilePath, JSON.stringify(translations, null, 2), 'utf8');
    console.log('Translation keys have been updated in translations.json');
};

// Start the process
processFiles();
