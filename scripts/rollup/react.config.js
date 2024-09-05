import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils"
import generatePackageJson from "rollup-plugin-generate-package-json"

const { name, module } = getPackageJSON('react')
//react包的路径
const pkgPath = resolvePkgPath(name)
//react产物路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
  //如果只写一个，那么打包之后只有一个文件，
  //react
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: 'index.js',
      format: 'umd'

    },
    plugins: [...getBaseRollupPlugins(),generatePackageJson({
      inputFolder:pkgPath,
      outputFolder:pkgDistPath,
      baseContents:({name,description,version})=>({
        name,
        description,
        version,
        main:'index.js'
      })
    })]
  },
  //jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      //jsx-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: `jsx-runtime.js`,
        formate: 'umd'
      },
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: `jsx-dev-runtime.js`,
        formate: 'umd'
      }
    ],
    plugins: getBaseRollupPlugins()
  }
]