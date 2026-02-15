import React from 'react'
import { Route } from 'react-router-dom'

const PrivateDemo = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">私有功能示例</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-300">
        这里是私有仓库注入的页面示例，用于验证公私混合部署的扩展点是否生效。
      </p>
    </div>
  )
}

export const getPrivateRoutes = () => {
  return <Route path="/private/demo" element={<PrivateDemo />} />
}

