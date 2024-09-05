import path from 'path'
import fs from 'fs'
import ts from 'rollup-plugin-typescript2'
import cjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
//当前包的路径
const pkgPath = path.resolve(__dirname, '../../packages');
//打包存放的路径
const distPath = path.resolve(__dirname, '../../dist/node_modules')

//
export function resolvePkgPath(pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`
  }
  return `${pkgPath}/${pkgName}`
}

//获取某个模块的package.json数据  pagName可以是react,左边目录中的
export function getPackageJSON(pagName) {
  //包路径
  const path = `${resolvePkgPath(pagName)}/package.json`
  //读取文件
  const str = fs.readFileSync(path, { encoding: 'utf-8' })

  return JSON.parse(str)
}

export function getBaseRollupPlugins({ alias = {
  __DEV__: true
},
  typescript = {} 
} = {}
) {
  return [replace(alias), cjs(), ts(typescript)]
}