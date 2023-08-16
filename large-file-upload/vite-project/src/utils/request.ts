import axios, { AxiosResponse } from 'axios'

interface HttpResponse<T=void> {
  data: T
}

// 设置请求头
const myBaseURL = 'http://localhost:3000'

// 创建axios实例
const service = axios.create({
    baseURL: myBaseURL, // 请求头
    timeout: 15000 // 请求超时时间
  })

// 响应拦截
service.interceptors.response.use(
  (response: AxiosResponse<HttpResponse>) => {
    // 返回的result不是1就用提示框提示后端返回的报错提示
    // response.data.result !== 1 ? Message.error({content: response.data.message || 'Error',duration: 5 * 1000}) : ''
    return response.data
  },
  (error) => {
    // Message.error({content: error.msg,duration: 5 * 1000});
    return Promise.reject(error)
  }
)

export default service
