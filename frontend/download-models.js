import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 모델 파일 목록
const modelFiles = [
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_recognition_model-weights_manifest.json',
  'age_gender_model-shard1',
  'age_gender_model-weights_manifest.json',
  'face_expression_model-shard1',
  'face_expression_model-weights_manifest.json'
];

const modelsDir = path.join(__dirname, 'public', 'models');
const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

// models 디렉토리가 없으면 생성
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${path.basename(filepath)}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // 파일 삭제
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('Starting face-api.js model downloads...');
  
  for (const file of modelFiles) {
    const url = baseUrl + file;
    const filepath = path.join(modelsDir, file);
    
    try {
      await downloadFile(url, filepath);
    } catch (error) {
      console.error(`Error downloading ${file}:`, error.message);
    }
  }
  
  console.log('Download completed!');
}

downloadModels(); 