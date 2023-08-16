<template>
    <div v-for="item in props.taskArr" :key="item.id">
      <div class="list_item">
        <div class="left_box">
          <p class="left_box_fileName">
            {{ item.name }}
          </p>
          <div class="left_box_percentage">
            <div class="percentage_bac">
              <div
                class="percentage_box"
                :style="{ width: `${item.percentage}%` }"
              ></div>
              <div class="percentage_box_span">
                <span>{{ Math.floor(item.percentage) }}%</span>
              </div>
            </div>
            <div class="bottom_hint">
              <div>
                <p>{{ fileSize(item.fileSize) }}</p>
              </div>
              <div style="margin-left: 4px">
                <div
                  v-if="item.state === 0"
                  style="height: 24px; width: 100%"
                ></div>
                <p v-else-if="item.state === 1">正在解析中...</p>
                <p v-else-if="item.state === 2">正在上传中...</p>
                <p v-else-if="item.state === 3">暂停中</p>
                <p v-else-if="item.state === 4">上传完成</p>
                <p v-else-if="item.state === 5">上传中断</p>
                <p v-else-if="item.state === 6">上传失败</p>
              </div>
            </div>
          </div>
        </div>
        <div class="rightBtn">
          <div
            class="my_btn redBtn"
            @click="pauseUpdate(item)"
            v-if="[1, 2].includes(item.state)"
          >
            暂停
          </div>
          <!-- 暂停中显示的继续按钮 -->
          <div
            class="my_btn blueBtn"
            @click="goonUpdate(item)"
            v-if="[3, 5].includes(item.state)"
          >
            继续
          </div>
          <div class="my_btn redBtn" @click="reset(item)">取消</div>
        </div>
      </div>
    </div>
    <div style="height: 108px"></div>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits } from "vue";
// 解决导入冲突问题
import { defineProps as defProps, defineEmits as defEmits } from "vue";
import { taskArrItem } from "@/api/home";
// 显示到视图层的初始数据:
const props = defineProps({
  taskArr: { type: Array<taskArrItem>, default: [] },
});
const emit = defineEmits(["pauseUpdate", "goonUpdate", "reset"]);
// 暂停
const pauseUpdate = (item: taskArrItem) => {
  emit("pauseUpdate", item);
};
// 继续上传
const goonUpdate = (item: taskArrItem) => {
  emit("goonUpdate", item);
};
// 取消
const reset = (item: taskArrItem) => {
  emit("reset", item);
};
// 显示文件大小
const fileSize = (val: number) => {
  const m = 1024 * 1024;
  if (val > m) {
    const num = Math.ceil(val / m);
    const numB = Math.ceil(num / 1024);
    if (numB > 1) {
      return `${numB}G`;
    } else {
      return `${num}M`;
    }
  } else {
    const numC = Math.ceil(val / 1024);
    return `${numC}KB`;
  }
};
</script>

<style scoped>
.list_item {
  margin: 0 10px 20px 10px;
  display: flex;
  transition: all 1s;
}
.percentage_bac {
  height: 20px;
  width: 100%;
  border-radius: 8px;
  background-color: #1b1f24;
  margin: 10px 0;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.5) inset;
  position: relative;
  overflow: hidden;
}
.percentage_box {
  height: 100%;
  transition: all 0.1s;
  background-color: #73c944;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.percentage_box_span {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  font-size: 14px;
  color: #e1eae2;
  height: 20px;
  line-height: 20px;
}
.left_box {
  flex: 1;
  margin: 10px 0;
  font-size: 14px;
}
.left_box_percentage {
  flex: 1;
  margin: 0 10px;
}
.left_box_fileName {
  margin: 0 10px;
  font-weight: bold;
  font-size: 18px;
}
.rightBtn {
  display: flex;
  width: 130px;
  font-size: 14px;
  justify-content: center;
  align-items: center;
}
.my_btn {
  padding: 2px 10px;
  height: 24px;
  border-radius: 8px;
  display: flex;
  cursor: pointer;
  margin: 10px 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  min-width: 48px;
}
.my_btn:hover {
  opacity: 1;
}
.blueBtn {
  background-color: #409eff;
}
.redBtn {
  background-color: #f56c6c;
}
.bottom_hint {
  opacity: 0.8;
  display: flex;
  align-items: center;
}
</style>
