import { loadEnvIfNeeded } from './lib/load_env.mjs';

loadEnvIfNeeded();

async function testLogin() {
  const email = process.env.ADMIN_EMAIL || 'admin@phowson.com';
  const password = process.env.ADMIN_PASSWORD || '';

  console.log('测试登录...');
  console.log('Email:', email);
  console.log('Password:', password ? '***' : '未设置');

  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json();
  console.log('登录响应状态:', loginRes.status);
  console.log('登录响应数据:', JSON.stringify(loginData, null, 2));

  if (!loginData.token) {
    console.error('登录失败：没有返回 token');
    return null;
  }

  return loginData.token;
}

async function testUpload(token) {
  console.log('\n测试上传权限...');

  const uploadRes = await fetch('http://localhost:3001/photos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: null,
  });

  console.log('上传响应状态:', uploadRes.status);
  const uploadData = await uploadRes.text();
  console.log('上传响应数据:', uploadData);
}

async function testAuthMe(token) {
  console.log('\n测试认证状态...');

  const authRes = await fetch('http://localhost:3001/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  console.log('认证响应状态:', authRes.status);
  const authData = await authRes.json();
  console.log('认证响应数据:', JSON.stringify(authData, null, 2));
}

async function main() {
  const token = await testLogin();
  if (!token) {
    console.error('无法继续测试上传，因为登录失败');
    return;
  }

  await testAuthMe(token);
  await testUpload(token);
}

main().catch(console.error);
