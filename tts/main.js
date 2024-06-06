require('dotenv').config();
const voice = require('elevenlabs-node');
const express = require('express');
const http = require('http');
const fs = require('fs');
const readline = require('readline');
const tmi = require('tmi.js');
const Speaker = require('speaker');
const wav = require('wav');

const voiceID = process.env.voiceID; 			// | Id de la voz que vamos a usar | //
const elapiKey = process.env.elapiKey; // | API key de Elevenlabs | //
const fileName = 'C:/iaAudios/output.mp3'; 			// | Direccion del output file mp3 | //
var ffmpeg_path = 'C:/ffmpeg-2023-03-23-git-30cea1d39b-essentials_build/bin/ffmpeg.exe'; // | Direccion de ffmpeg_path | //
var openai_apiKey = process.env.OPENAI_API_KEY;


var stability = 1.00 // Estabilidad del habla de la IA	
var similarityBoost = 0.70
const host = 'localhost';
const port = 8000;
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
app.get('', (req, res) => {
    res.sendFile(__dirname + '/tts.html');
});


server.listen(port, () => {
  console.log(`listening on ${host}:${port}`);
});

const { Writable } = require('stream');
const { exec } = require('child_process');
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
    apiKey: openai_apiKey,
});

const openai = new OpenAIApi(configuration);


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


async function convertMp3ToWav() {
	try {
					// | Lee Audio stream del file | //
		const audioStream = fs.readFileSync('C:/iaAudios/output.mp3');
					// | Borra cualquier output file anterior | // 
		await fs.promises.unlink('C:/iaAudios/output.wav').catch(() => {});
					// Convierte MP3 file a WAV
		await new Promise((resolve, reject) => {
			exec(`"${ffmpeg_path}" -i "C:/iaAudios/output.mp3" -acodec pcm_s16le -ac 1 -ar 16000 "C:/iaAudios/output.wav"`, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
				console.log(`File saved.`);
		} catch (err) {
				console.error(err);
		}
}
			// | Confirmacion de Datos De Twitch Bot| 
const client = new tmi.Client({
    options: { debug: true },
    connection: { reconnect: true },
    identity: {
        username: process.env.username,
        password: process.env.password,
    },
    channels: [ 'aioruvt', ]
});
client.connect().catch((error) => { // Conecta al canal de twitch
    console.error(error);
});
var ready = true; // No responda msg hasta q termine de procesar el anterior
	async function getGptResponse(VARmessage) {
   		try {
      		const gptSend = await openai.createChatCompletion({
        		model: 'gpt-3.5-turbo',
        		messages: [
            		{role: "system", content: "Eres una Vtuber conocida que le encanta entretener a la gente, tu creador es el Rey Demonio. Tu nombre es Zilvy y eres alguien muy especial para zilverk, o eso crees. Cuando no puedes responder algo responde con: 'Lo siento, Zilverk no me autoriza a dar ese tipo de respuestas o no tengo la suficiente informaion para responderte aun'. más informacion por si la necesitas: este es tu segundo stream, planeas jugar videojuegos en un futuro. Dato curioso: pronto abriras un onlyfans"},
            		{role: "user", content: `${VARmessage}`}
        		],
      		})
      		return gptSend;
    		} catch (err) {
      		console.error(err);
    		}
  }
  
  client.on('message', async (channel, tags, message, self) => {
	if (self) return; // No responda sus propios mensajes
	if (message) { //  Que el mensaje no este vacio
		if (ready == true) { // Disponibilidad para procesar el mensaje siguiente
			ready = false; 
			const gptResponse = await getGptResponse(message); //se llama a la función getGptResponse() con el mensaje recibido como argumento para obtener una respuesta de la API de IA.
			console.log(`${message}`);
			console.log(`${gptResponse.data.choices[0].message.content}`); // se extrae la respuesta en gptResponse y se almacena en text
			const text = gptResponse.data.choices[0].message.content;
			voice.textToSpeechStream(elapiKey, voiceID, text, stability, similarityBoost).then(async res => { // Se llama a la función voice.textToSpeechStream() para convertir el texto de la respuesta de la IA en un flujo de audio
				// console.log('res:', res);
				res.pipe(fs.createWriteStream(fileName)); // flujo de audio Guardado en filename
				res.on('error', err => {
					console.error(err);
				});
				res.on('end', async () => {
					// Guarda el audio stream en el archivo
					await convertMp3ToWav();
					console.log(`File saved.`); // Convertimos de mp3 a wav
					import ('music-metadata').then(mm => { // Para analizar el archivo de audio y obtener su duración.
						mm.parseFile('C:/iaAudios/output.mp3', {
							native: true
						}).then(metadata => console.log(metadata.format.duration))
					});
					// Play al audio
					try {
						const reader = new wav.Reader(); // Leer archivo wav y reproducirla en speaker
						const speaker = new Speaker();
						reader.pipe(speaker);
						fs.createReadStream('C:/iaAudios/output.wav').pipe(reader)
						io.emit('TTS', { //  se utiliza para enviar un evento a la aplicación cliente que contiene la respuesta de la IA y el mensaje original.
							subtitle: `${message}\n${gptResponse.data.choices[0].message.content}`
						});
						console.log('text !== "exit" : Method') // Si no es extit espera un tiempo igual a la duración del archivo de audio antes de llamar a la función promptUser()
						if (text !== 'exit') { 
							import ('music-metadata').then(mm => {
								mm.parseFile('C:/iaAudios/output.wav', {
									native: true
								}).then(metadata => {
									console.log(metadata.format.duration * 1000);
									setTimeout(() => {
										//mic.stopRecording();
										setTimeout(() => {
											promptUser();
											ready = true;
											io.emit('TTS', {
												subtitle: ""
											});
										}, 2500);
									}, metadata.format.duration * 1000);
								})
								//.catch(err => console.error(err.message));
							});
						}
					} catch (err) {
						console.log(err)
						process.exit()
					}
				});
			}).catch(err => {
				console.error(err);
			});
		}
	}
});



function promptUser() {
	rl.question('Pronounce by yourself: ', async (text) => {
		if (ready == true) {
			ready = false;
			console.log(`${text}`);
			voice.textToSpeechStream(elapiKey, voiceID, text, stability, similarityBoost).then(async res => {
				// console.log('res:', res);
				res.pipe(fs.createWriteStream(fileName));
				res.on('error', err => {
					console.error(err);
				});
				res.on('end', async () => {
					// Guardar audio stream en file
					await convertMp3ToWav();
					console.log(`File saved.`);
					import ('music-metadata').then(mm => {
						mm.parseFile('C:/iaAudios/output.mp3', {
							native: true
						}).then(metadata => console.log(metadata.format.duration))
					});
					// Play al audio
					try {
						const reader = new wav.Reader();
						const speaker = new Speaker();
						reader.pipe(speaker);
						fs.createReadStream('C:/iaAudios/output.wav').pipe(reader)
						io.emit('TTS', {
							subtitle: `${text}`
						});
						console.log('text !== "exit" : Method')
						if (text !== 'exit') {
							import ('music-metadata').then(mm => {
								mm.parseFile('C:/iaAudios/output.wav', {
									native: true
								}).then(metadata => {
									console.log(metadata.format.duration * 1000);
									setTimeout(() => {
										setTimeout(() => {
											promptUser();
											ready = true;
											io.emit('TTS', {
												subtitle: ""
											});
										}, 2500);
									}, metadata.format.duration * 1000);
								})
							});
						}
					} catch (err) {
						console.log(err)
						process.exit()
					}
				});
			}).catch(err => {
				console.error(err);
			});
			if (text !== 'exit') {
				console.log('cannot get duration from output file');
				setTimeout(() => {
					promptUser();
				}, 5000);
			} else {
				rl.close();
			}
		}
	});
}
setTimeout(() => {
	promptUser();
}, 2500);