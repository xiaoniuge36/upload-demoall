<template>
  <div class="page">
    <div class="page_top">
      <p>正在上传 ({{ statistics }})</p>
      <div class="page_top_right" :style="{ 'justify-content': taskArr.length > 1 ? 'space-between' : 'flex-end' }">
        <p class="clear_btn" @click="clear" v-if="taskArr.length > 1">全部取消</p>
        <p class="clear_btn" @click="clickClearDir">清空本地和服务器存储的文件</p>
      </div>
    </div>
    <div class="content" ref="contentRef">
      <ListItem :task-arr="taskArr" @pauseUpdate="pauseUpdate" @goonUpdate="goonUpdate" @reset="reset" />
    </div>
    <div class="bottom_box">
      <div class="input_btn">
        选择文件上传
        <input type="file" multiple class="is_input" @change="inputChange">
      </div>
    </div>
  </div>
  <div class="messageList">
    <!-- <div class="messageBac">
        <div class="message">
            <p>合并成功</p>
        </div>
      </div> -->
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, getCurrentInstance, toRaw, watch, computed, nextTick } from 'vue'
import { update, checkFile, mergeSlice, AllDataItem, taskArrItem, clearDir } from '@/api/home'
import ListItem from '@/listItem.vue'
// 显示到视图层的初始数据:
const contentRef = ref()
const localForage = (getCurrentInstance()!.proxy as any).$localForage
const unit = 1024 * 1024 * 1  //每个切片的大小定位3m
const taskArr = ref<Array<taskArrItem>>([])
let uploadingArr: Array<taskArrItem> = []
let maxNumb = 6  // 最大请求并发数
const statistics = computed(() => {
  const otherArr = taskArr.value.filter(item => item.state !== 4)
  return `${otherArr.length}/${taskArr.value.length}`
})
// 监听任务改变
watch(() => taskArr.value, (newVal, oldVal) => {
  setTaskArr()
}, { deep: true })
// 页面一打开就调用:
onMounted(() => {
  getTaskArr()
})
// 注册事件:
// 暂停
const pauseUpdate = (item: taskArrItem, elsePause = true) => {
  // 先看是不是失败的,如果不是elsePause为true,就是暂停.为false就是中断
  if (![4, 6].includes(item.state)) {
    elsePause ? item.state = 3 : item.state = 5
  }
  item.errNumber = 0
  for (const itemB of item.allData) {
    itemB.cancel ? itemB.cancel() : ''
  }
}
// 继续
const goonUpdate = (item: taskArrItem) => {
  item.state = 2
  const progressTotal = 100 - item.percentage
  item.allData.push(...item.whileRequests)
  item.whileRequests = []
  slicesUpdate(item, progressTotal)
}
// 取消,取消了就是不想继续上传了,所以两个数组都将这个进度删掉
const reset = async (item: taskArrItem) => {
  pauseUpdate(item)
  taskArr.value = toRaw(taskArr.value).filter(itemB => itemB.id !== item.id)
  uploadingArr = uploadingArr.filter(itemB => itemB.id !== item.id)
}
// 全部取消
const clear = () => {
  for (const item of taskArr.value) { pauseUpdate(item) }
  const allId = toRaw(taskArr.value).map(item => item.id)
  uploadingArr = uploadingArr.filter(item => !allId.includes(item.id))
  taskArr.value = []
}
// 清空
const clickClearDir = async () => {
  for (const item of taskArr.value) { pauseUpdate(item) }
  const res = await clearDir()
  if (res.result === 1) {
    taskArr.value = []
    uploadingArr = []
    localForage.clear()
    message('清空成功')
  }
}
// 设置已完成
const isFinishTask = (item: taskArrItem) => {
  item.percentage = 100
  item.state = 4
}
// 输入框change事件
const inputChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files as FileList
  for (let h = 0; h < files.length; h++) {
    const file = files[h]
    console.log(file, 'file')
    h === files.length - 1 ? nextTick(() => { target.value = '' }) : ''
    let inTaskArrItem: taskArrItem = {
      id: new Date().getTime(),
      md5: '',
      name: file.name,
      state: 0,
      fileSize: file.size,
      allData: [],  // 所有请求的数据
      whileRequests: [],  // 正在请求中的请求个数,目前是要永远都保存请求个数为6
      finishNumber: 0,  //请求完成的个数
      errNumber: 0,  // 报错的个数,默认是0个,超多3个就是直接上传中断
      percentage: 0
    }
    taskArr.value.push(inTaskArrItem)
    nextTick(() => { contentRef.value.scrollTop = (110 + 20) * (taskArr.value.length + 1) })  // 设置滚动条滚到最底部
    inTaskArrItem = taskArr.value.slice(-1)[0]
    inTaskArrItem.state = 1
    if (file.size === 0) {
      // 文件大小为0直接上传失败
      inTaskArrItem.state = 6
      pauseUpdate(inTaskArrItem, false)
      continue
    }
    const fileMd5 = await useWorker(file)
    console.log(fileMd5, '哈希计算完成')
    inTaskArrItem.state = 2
    inTaskArrItem.md5 = fileMd5 as string
    const sliceNumber = Math.ceil(file.size / unit)  // 向上取证切割次数,例如20.54,那里就要为了那剩余的0.54再多遍历一次
    // 先看是不是有同一个文件在上传中或者在那暂停着
    // 再查本地再查远程服务器,本地已经上传了一半了就重新切割好对上指定的片,继续上传就可以了,state为2是上传中,3是暂停中
    const isNeedUploadingArr = uploadingArr.filter(item => fileMd5 === item.md5 && item.state === 2)
    const theSameMd5Arr = toRaw(taskArr.value).filter(item => item.md5 === fileMd5)  // 和当前文件的哈希值一致的文件进度
    const needDelete = theSameMd5Arr.pop()
    if (theSameMd5Arr.length > 0 && theSameMd5Arr[0].state !== 4) {
      const firstItem = theSameMd5Arr[0]
      const needIndex = taskArr.value.findIndex((item) => item.id === needDelete!.id)
      const needIndexB = taskArr.value.findIndex((item) => item.id === firstItem.id)
      if (firstItem.state === 2) {
        message(`${firstItem.name} 已经正在上传中了`)
        taskArr.value.splice(needIndex, 1)
      } else if (firstItem.state === 3 || firstItem.state === 5) {
        message(`${needDelete!.name} 之前已经上传了部分,现在可以继续上传`)
        taskArr.value.splice(needIndex, 1)
        const updateObj = taskArr.value[needIndexB]
        updateObj.state = 2
        updateObj.allData.push(...updateObj.whileRequests)
        updateObj.whileRequests = []
        inTaskArrItem = updateObj
        slicesUpdate(inTaskArrItem)
      }
    } else if (isNeedUploadingArr.length > 0) {
      const updateTaskObj = isNeedUploadingArr[0]
      message(`${updateTaskObj.name} 之前已经上传了部分,现在可以继续上传`)
      for (let i = 0; i < sliceNumber; i++) {
        const inFileMd5 = `${updateTaskObj.md5}-${i}`
        const inAllDataItem = updateTaskObj.allData.find((item) => item.fileMd5 === inFileMd5)
        inAllDataItem ? inAllDataItem.file = file.slice(i * unit, i * unit + unit) : ''
      }
      const needIndex = taskArr.value.findIndex((item) => item.md5 === fileMd5)
      taskArr.value.splice(needIndex, 1, updateTaskObj)
      inTaskArrItem = taskArr.value[needIndex]
      slicesUpdate(inTaskArrItem)
    } else {
      try {
        const resB = await checkFile({ md5: fileMd5, size: inTaskArrItem.fileSize })
        const { result } = resB
        // 返回1说明服务器没有
        if (result === 1) {
          for (let i = 0; i < sliceNumber; i++) {
            const sliceFile = file.slice(i * unit, i * unit + unit)
            const needObj: AllDataItem = {
              file: sliceFile,
              fileMd5: `${fileMd5}-${i}`,
              sliceFileSize: sliceFile.size,
              index: i,
              fileSize: file.size,
              fileName: file.name,
              sliceNumber,
              finish: false
            }
            inTaskArrItem.allData.push(needObj)
          }
          // console.log(inTaskArrItem,'inTaskArrItem')
          slicesUpdate(inTaskArrItem)
        } else {
          // -1就是直接秒传完成,-2就是直接上传中断提示服务器剩余容量不足
          if (result === -1) {
            isFinishTask(inTaskArrItem)
          } else if (result === -2) {
            pauseUpdate(inTaskArrItem, false)
            message('服务器剩余容量不足! 请清空本地和服务器存储的文件')
          }
        }
      } catch (err) {
        pauseUpdate(inTaskArrItem, false)
        continue
      }
    }
  }
}
// Promise封装web Worker计算结果返回
const useWorker = (file: File) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./js/hash.js')  //复杂的计算,使用web Worker提高性能
    worker.postMessage({ file })
    worker.onmessage = (e) => {
      const { name, data } = e.data
      name === 'succeed' ? resolve(data) : reject(data)
    }
  })
}
// 切片上传
const slicesUpdate = (taskArrItem: taskArrItem, progressTotal = 100) => {
  // 一片都没有了,或者有正在请求中的接口,都直接不执行下边的逻辑,毕竟都有正在请求中的还上传,容易造成并发数高于浏览器限制
  if (taskArrItem.allData.length === 0 || taskArrItem.whileRequests.length > 0) { return }
  const isTaskArrIng = toRaw(taskArr.value).filter(itemB => itemB.state === 1 || itemB.state === 2)
  maxNumb = Math.ceil(6 / isTaskArrIng.length)  // 实时动态获取并发请求数,每次掉请求前都获取一次最大并发数
  const whileRequest = taskArrItem.allData.slice(-maxNumb)
  taskArrItem.allData.length > maxNumb ? taskArrItem.allData.length = taskArrItem.allData.length - maxNumb : taskArrItem.allData.length = 0
  taskArrItem.whileRequests.push(...whileRequest)
  for (const item of whileRequest) {
    isUpdate(item)
  }
  // 单个分片请求
  async function isUpdate(needObj: AllDataItem) {
    const fd = new FormData()
    const { file, fileMd5, sliceFileSize, index, fileSize, fileName, sliceNumber } = needObj
    fd.append('file', file as File)
    fd.append('fileMd5', fileMd5)
    fd.append('sliceFileSize', String(sliceFileSize))
    fd.append('index', String(index))
    fd.append('fileSize', String(fileSize))
    fd.append('fileName', fileName)
    fd.append('sliceNumber', String(sliceNumber))
    const res = await update(fd, (cancel) => { needObj.cancel = cancel }).catch(() => { })
    if (taskArrItem.state === 5 || taskArrItem.state === 3) { return }  // 你的状态都已经变成暂停或者中断了,就什么都不要再做了,及时停止
    // 请求异常,或者请求成功服务端返回报错都按单片上传失败逻辑处理,.then.catch的.catch是只能捕捉请求异常的
    if (!res || res.result === -1) {
      taskArrItem.errNumber++
      // 超过3次之后直接上传中断
      if (taskArrItem.errNumber > 3) {
        console.log('超过三次了')
        pauseUpdate(taskArrItem, false)  // 上传中断
      } else {
        console.log('还没超过3次')
        isUpdate(needObj)  // 失败了一片,单个分片请求
      }
    } else {
      const { result, data } = res
      if (result === 1) {
        sliceProgress(needObj, taskArrItem, progressTotal)  // 更新进度条
        taskArrItem.errNumber > 0 ? taskArrItem.errNumber-- : ''
        taskArrItem.finishNumber++
        needObj.finish = true
        taskArrItem.whileRequests = taskArrItem.whileRequests.filter(item => item.index !== needObj.index)  // 上传成功了就删掉请求中数组中的那一片
        console.log(taskArrItem.whileRequests.length, '请求成功了')
        if (taskArrItem.finishNumber === sliceNumber) {
          const resB = await mergeSlice(data).catch(() => { })
          resB && resB.result === 1 ? isFinishTask(taskArrItem) : pauseUpdate(taskArrItem, false)
          taskArrItem.finishNumber = 0
        } else {
          slicesUpdate(taskArrItem)
        }
      } else if (result === -2) {
        pauseUpdate(taskArrItem, false)
        message('服务器剩余容量不足! 请清空本地和服务器存储的文件')
      }
    }
  }
}
// 更新进度条
const sliceProgress = (needObj: AllDataItem, taskArrItem: taskArrItem, progressTotal: number) => {
  // 即使是超时请求也是会频繁的返回上传进度的,所以只能写成完成一片就添加它所占百分之多少,否则会造成误会
  const placeholder = progressTotal / needObj.sliceNumber  // 每一片占100的多少
  taskArrItem.percentage = taskArrItem.percentage + placeholder
}
// 获取本地有没要继续上传的任务,状态为2都是可以继续上传的,1,4和5都没必要继续上传了
// 暂停的,继续上传的,上传中断的自动继续上传
const getTaskArr = async () => {
  const arr = await localForage.getItem('taskArr').catch(() => { })
  if (!arr || arr.length === 0) { return }
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (item.state === 3 || item.state === 5 || item.state === 2) {
      item.state = 2
      item.allData.push(...item.whileRequests)
      item.whileRequests.length = 0
    }
    if (item.state !== 2) {
      arr.splice(i, 1)
      i--
    }
  }
  uploadingArr = arr
  console.log(uploadingArr, 'uploadingArr')
}
// 存储任务到缓存
const setTaskArr = async () => {
  // localForage这个库的api不兼容Proxy对象和函数,要处理一下
  const needTaskArr = JSON.parse(JSON.stringify(taskArr.value))
  await localForage.setItem('taskArr', needTaskArr)
  // console.log('存储成功')
}
// 消息提示
const message = (msg: string, duration = 3000) => {
  const messageList = document.querySelector('.messageList') as Element
  messageList.innerHTML = ''
  const div = document.createElement('div')
  div.className = 'messageBac'
  div.innerHTML = `<div class="message">
                          <p>${msg}</p>
                      </div>`
  messageList.appendChild(div)
  setTimeout(() => {
    div.classList.toggle('messageShow')
    setTimeout(() => {
      div.classList.toggle('messageShow')
    }, duration)
  }, 0)
}
</script>
<style scoped>
.page {
  margin: 0 auto;
  background-color: #28323e;
  width: 100%;
  height: 100vh;
  color: #ffffff;
  position: relative;
}

.page_top {
  height: 48px;
  padding: 0 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #8386be;
}

.page_top_right {
  width: 260px;
  display: flex;
}

.page_top>p {
  padding: 12px;
}

.clear_btn {
  cursor: pointer;
  color: #853b3c;
  user-select: none;
}

.clear_btn:hover {
  cursor: pointer;
  color: #b65658;
}

.content {
  max-width: 1000px;
  margin: 0 auto;
  overflow-y: auto;
  height: calc(100vh - 128px);
  border-radius: 14px;
  background-color: #303944;
  border: 1px solid #252f3c;
  box-shadow: 0 0 10px rgba(0, 0, 0, .5) inset;
}

.bottom_box {
  text-align: center;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
}

.input_btn>input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.input_btn {
  width: 200px;
  background-color: #409eff;
  opacity: 0.8;
  position: relative;
  padding: 8px 16px;
  border-radius: 8px;
  margin: 0 auto;
  user-select: none;
}

.input_btn:hover {
  opacity: 1;
}

:deep(.messageBac) {
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  transition: all .3s;
  transform: translateY(-34px);
  opacity: 0;
}

:deep(.messageShow) {
  transform: translateY(20px);
  opacity: 1;
}

:deep(.message) {
  background-color: #c7d1e5;
  color: #737a88;
  border-radius: 8px;
  padding: 4px 16px;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background-color: #404755;
  border-radius: 4px;
  cursor: pointer;
}

::-webkit-scrollbar-thumb:hover {
  background-color: #4d5564;
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}</style>