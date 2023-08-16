// 注解axios返回的数据,第一层特有的数据的数据类型
import 'axios'

declare module 'axios' {
  export interface AxiosResponse {
    result:number
    msg:string
  }
}