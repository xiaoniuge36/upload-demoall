var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '123456',
  database : 'ceshi'
});
// 打开连接
connection.connect(err=>{
    if(!err){
        console.log('mysql连接成功')
    }else{
        console.log('mysql连接失败')
    }
});

module.exports = connection