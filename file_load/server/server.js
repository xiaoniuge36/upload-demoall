const http = require('http');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const multiparty = require('multiparty');

const server = http.createServer();
const UPLOAD_DIR = path.join(__dirname, '..', 'target');

const resolvePost = (req) => {
	return new Promise((resolve) => {
		let chunk = '';
		req.on('data', (data) => {
			chunk += data;
		});
		req.on('end', () => {
			resolve(JSON.parse(chunk));
		});
	});
};

const extractExt = (filename) =>
	filename.slice(filename.lastIndexOf('.'), filename.length);

const createUploadedList = async (fileHash) => {
	const fileDir = path.join(UPLOAD_DIR, fileHash);
	return fse.existsSync(fileDir) ? await fse.readdir(fileDir) : [];
};

const pipeStream = (chunkPath, writeStream) => {
	return new Promise((resolve) => {
		const chunkReadStream = fse.createReadStream(chunkPath);
		chunkReadStream.on('end', () => {
			fse.unlinkSync(chunkPath);
			resolve();
		});
		chunkReadStream.pipe(writeStream);
	});
};

const mergeFileChunks = async (targetFilePath, fileHash, chunkSize) => {
	const chunkDir = path.join(UPLOAD_DIR, fileHash);
	const chunkNames = await fse.readdir(chunkDir);
	chunkNames.sort((a, b) => a.split('_')[1] - b.split('_')[1]);

	await fse.writeFileSync(targetFilePath, '');

	await Promise.all(
		chunkNames.map((chunkName, index) => {
			const chunkPath = path.join(chunkDir, chunkName);
			return pipeStream(
				chunkPath,
				fse.createWriteStream(targetFilePath, {
					start: index * chunkSize,
				})
			);
		})
	);

	await fse.rmdir(chunkDir);
};

server.on('request', async (req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', '*');
	if (req.method === 'OPTIONS') {
		res.end();
		return;
	}

	if (req.url === '/verify') {
		const data = await resolvePost(req);
		const { fileHash, fileName } = data;

		const ext = extractExt(fileName);
		const filePath = path.join(UPLOAD_DIR, `${fileHash}${ext}`);

		if (fse.existsSync(filePath)) {
			res.end(
				JSON.stringify({
					shouldUploadFile: false,
				})
			);
		} else {
			res.end(
				JSON.stringify({
					shouldUploadFile: true,
					uploadedChunks: await createUploadedList(fileHash),
				})
			);
		}
		return;
	}

	if (req.url === '/merge') {
		const data = await resolvePost(req);
		const { fileHash, fileName, chunkSize } = data;
		const ext = extractExt(fileName);
		const targetFilePath = path.join(UPLOAD_DIR, `${fileHash}${ext}`);
		await mergeFileChunks(targetFilePath, fileHash, chunkSize);

		res.end(
			JSON.stringify({
				code: 0,
				msg: `文件 ${fileName} 合并完成。`,
			})
		);
		return;
	}

	const multipart = new multiparty.Form();

	multipart.parse(req, async (err, fields, files) => {
		if (err) {
			return;
		}
		const [chunk] = files.chunk;
		const [hash] = fields.hash;
		const [fileHash] = fields.fileHash;
		const chunkDir = path.join(UPLOAD_DIR, fileHash);

		if (!fse.existsSync(chunkDir)) {
			await fse.mkdirs(chunkDir);
		}

		await fse.move(chunk.path, `${chunkDir}/${hash}`, { overwrite: true });
		res.status = 200;
		res.end('收到文件片段');
	});
});

// 删除文件夹接口
// server.on('request', async (req, res) => {
// 	res.setHeader('Access-Control-Allow-Origin', '*');
// 	res.setHeader('Access-Control-Allow-Headers', '*');
// 	if (req.method === 'OPTIONS') {
// 		res.end();
// 		return;
// 	}
// 	try {
// 		let finishDir = path.join(UPLOAD_DIR, 'finish');
// 		let cacheDir = path.join(UPLOAD_DIR, 'cache');
// 		const files = fs.readdirSync(finishDir);
// 		const filesB = fs.readdirSync(cacheDir);
// 		for (const file of files) {
// 			// 注意:git是不能接收空文件夹的,.gitignore文件相当于空文件夹的占位文件夹,不能删它,如果删了它文件夹一空git会主动把你的空文件删掉
// 			file !== '.gitignore' ? fs.unlinkSync(`${finishDir}/${file}`) : ''
// 		}
// 		for (const file of filesB) {
// 			// node.js不支持删除有文件的文件夹,这种情况下就只能递归处理了
// 			file !== '.gitignore' ? rmdirSync(`${cacheDir}/${file}`) : ''
// 		}
// 		res.end({ code: 0, msg: '清空成功' })
// 	} catch (err) {
// 		res.end({ code: -1, msg: '清空失败', data: err })
// 	}
// });
// 删除目录和子目录
const rmdirSync = (function () {
	function iterator(url, dirs) {
		var stat = fs.statSync(url);
		if (stat.isDirectory()) {
			dirs.unshift(url);  //收集目录
			inner(url, dirs);
		} else if (stat.isFile()) {
			fs.unlinkSync(url);  //直接删除文件
		}
	}
	function inner(path, dirs) {
		var arr = fs.readdirSync(path);
		for (var i = 0, el; el = arr[i++];) {
			iterator(path + "/" + el, dirs);
		}
	}
	return function (dir, cb) {
		cb = cb || function () { };
		var dirs = [];
		try {
			iterator(dir, dirs);
			for (var i = 0, el; el = dirs[i++];) {
				fs.rmdirSync(el);  //一次性删除所有收集到的目录
			}
			cb()
		} catch (e) {
			//如果文件或目录本来就不存在，fs.statSync会报错，不过我们还是当成没有异常发生
			e.code === "ENOENT" ? cb() : cb(e);
		}
	}
})()

server.listen(8080, () => console.log('正在监听 8080 端口...'));
