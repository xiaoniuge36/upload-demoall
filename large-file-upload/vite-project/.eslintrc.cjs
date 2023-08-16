module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard',
    // 新增这里vue3支持
    'plugin:vue/vue3-recommended'
  ],
  // 规则
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true
    },
    requireConfigFile: false,
    parser: "@typescript-eslint/parser"
  },
  plugins: [
    'vue',
    "@typescript-eslint"
  ],
  rules: {
    'vue/mustache-interpolation-spacing': 0,
    'vue/html-self-closing': 0,
    'vue/html-closing-bracket-spacing': 0,
    'vue/html-indent': 0,
    'vue/attributes-order': 0,
    'vue/v-on-event-hyphenation': 0,
    'object-curly-newline': 0,
    'no-multi-spaces': 0,
    'spaced-comment': 0,
    'block-spacing': 0,
    'space-before-function-paren': 0,
    'arrow-spacing': 0,
    'keyword-spacing': 0,
    'comma-spacing': 0,
    'space-infix-ops': 0,
    'key-spacing': 0,
    'no-unused-expressions': 0,
    'object-curly-spacing': 0,
    'space-before-blocks': 0,
    'eol-last': 0,
    'prefer-const': 2,
    semi: [2, 'never'], // 禁止尾部使用分号“ ; ”
    indent: 0, // 缩进2格
    'no-mixed-spaces-and-tabs': 0, // 不能空格与tab混用
    'no-tabs': 0,
    quotes: 0, // 使用单引号
    'vue/html-closing-bracket-newline': 'off', // 不强制换行
    'vue/singleline-html-element-content-newline': 'off', // 不强制换行
    'vue/max-attributes-per-line': ['error', {
      singleline: { max: 5 },
      multiline: { max: 5 }
    }]
  }
}