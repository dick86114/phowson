export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  
  try {
    // 使用 OpenStreetMap Nominatim
    // 必须设置 User-Agent
    // zoom=10 对应 City 级别，zoom=18 对应街道级别
    // 我们主要需要城市级别
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Phowson-SelfHosted/1.0', 
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    
    if (!res.ok) {
      process.stderr.write(`Geocoding failed for ${lat},${lng}: ${res.status}\n`)
      return null;
    }
    
    const data = await res.json();
    if (!data || !data.address) return null;
    
    const { address } = data;
    
    // 优先顺序
    const city = address.city || address.town || address.village || address.county;
    const state = address.state;
    const country = address.country;
    
    // 构造显示名称: "国家 · 城市" 或 "国家 · 省份"
    if (country && city) {
        return `${country} · ${city}`;
    }
    if (country && state) {
        return `${country} · ${state}`;
    }
    if (country) {
        return country;
    }
    
    return city || state || null;
    
  } catch (err) {
    process.stderr.write(`Geocoding error: ${String(err?.message || err)}\n`)
    return null;
  }
}

export async function geocodeByName(name) {
  const q = String(name || '').trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Phowson-SelfHosted/1.0',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) {
      process.stderr.write(`Geocoding by name failed for ${q}: ${res.status}\n`);
      return null;
    }
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    const lat = Number.parseFloat(first.lat);
    const lng = Number.parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const location = String(first.display_name || '').trim();
    return { location, lat, lng };
  } catch (err) {
    process.stderr.write(`Geocoding by name error: ${String(err?.message || err)}\n`);
    return null;
  }
}
