import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils"
import generatePackageJson from "rollup-plugin-generate-package-json"
import alias from "@rollup/plugin-alias"


const { name, module,peerDependencies } = getPackageJSON('react-dom')
//react-dom包的路径
const pkgPath = resolvePkgPath(name)
//react-dom产物路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
  //如果只写一个，那么打包之后只有一个文件，
  //react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'index.js',
        format: 'umd'
  
      },
      {
        file:`${pkgDistPath}/client.js`,
        name:`client.js`,
        format:'umd'
      }
    ],
    // 在打包react-dom时，就不会将react的代码也打包进react-dom中，因为数据共享层的原因
    external:[...Object.keys(peerDependencies),'scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      //webpack resolve alias
      alias({
        entries:{
          hostConfig:`${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
      inputFolder:pkgPath,
      outputFolder:pkgDistPath,
      baseContents:({name,description,version})=>({
        name,
        description,
        version,
        peerDependencies:{
          react:version
        },
        main:'index.js'
      })
    })]
  }
]