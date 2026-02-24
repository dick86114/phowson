
import assert from 'node:assert/strict';
import { inferSupplementalFromImage } from '../lib/ai_provider.mjs';
import { pool } from '../db.mjs';

// Mock global.fetch
const originalFetch = global.fetch;
const mockFetch = async (url, options) => {
    const urlStr = String(url);
    
    // Mock Nominatim
    if (urlStr.includes('nominatim.openstreetmap.org')) {
        if (urlStr.includes('Paris')) {
            return {
                ok: true,
                json: async () => ([{ lat: '48.8566', lon: '2.3522', display_name: 'Paris, France' }])
            };
        }
        if (urlStr.includes('Tokyo')) {
            return {
                ok: true,
                json: async () => ([{ lat: '35.6762', lon: '139.6503', display_name: 'Tokyo, Japan' }])
            };
        }
        return { ok: true, json: async () => [] };
    }

    // Mock AI Provider (OpenAI Compatible)
    if (urlStr.includes('/chat/completions')) {
        const body = JSON.parse(options.body);
        const prompt = body.messages[0].content[0].text || body.messages[0].content; // Handle both structure if needed

        // Filename Location Check
        if (prompt.includes('isLocation')) {
            // Check if input is "Paris Trip"
            if (prompt.includes('Paris Trip')) {
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        choices: [{
                            message: {
                                content: JSON.stringify({ isLocation: true, confidence: 0.9, locationName: 'Paris' })
                            }
                        }]
                    })
                };
            }
            return {
                ok: true,
                text: async () => JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify({ isLocation: false, confidence: 0.9, locationName: '' })
                        }
                    }]
                })
            };
        }

        // Watermark OCR (Vision)
        if (prompt.includes('仅输出图片中可见的文字内容')) {
            return {
                ok: true,
                text: async () => JSON.stringify({
                    choices: [{
                        message: {
                            content: 'Shot in Tokyo 2023-11-11'
                        }
                    }]
                })
            };
        }

        // Watermark Analysis
        if (prompt.includes('OCR 文本内容')) {
            if (prompt.includes('Tokyo')) {
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    location: { value: 'Tokyo', confidence: 0.95 },
                                    datetime: { value: '2023-11-11T10:00:00+09:00', confidence: 0.95 }
                                })
                            }
                        }]
                    })
                };
            }
        }
        
        return {
            ok: true,
            text: async () => JSON.stringify({ choices: [{ message: { content: '{}' } }] })
        };
    }

    return originalFetch(url, options);
};

global.fetch = mockFetch;

// Mock Env
process.env.AI_PROVIDER = 'openai_compatible';
process.env.AI_BASE_URL = 'http://mock-ai-server';
process.env.AI_API_KEY = 'mock-key';
process.env.AI_MODEL = 'mock-model';

const runTests = async () => {
    console.log('Starting AI Supplemental Tests...');
    
    // Clean cache
    await pool.query('DELETE FROM ai_parse_cache');

    try {
        // Test 1: Filename Date (Pure Logic)
        console.log('Test 1: Filename Date');
        const res1 = await inferSupplementalFromImage({
            imageBase64: 'AA==',
            filename: '2023-10-01.jpg',
            hasDate: false,
            hasLocation: true
        });
        assert.equal(res1.supplemental.dateTime.dateOnly, '2023-10-01');
        assert.equal(res1.supplemental.dateTime.source, 'filename');
        assert.ok(!res1.supplemental.location); // hasLocation=true should prevent parsing

        // Test 2: Filename Location (Mock AI + Geo)
        console.log('Test 2: Filename Location');
        const res2 = await inferSupplementalFromImage({
            imageBase64: 'AA==',
            filename: 'Paris Trip 001.jpg',
            hasDate: true,
            hasLocation: false
        });
        assert.ok(res2.supplemental.location);
        assert.ok(res2.supplemental.location.value.includes('Paris'));
        assert.equal(res2.supplemental.location.source, 'filename');

        // Test 3: Watermark OCR (Mock Vision + Analysis + Geo)
        console.log('Test 3: Watermark OCR');
        // We use a different image hash to avoid cache conflict if any (though we cleared it)
        const res3 = await inferSupplementalFromImage({
            imageBase64: 'BB==', 
            filename: 'IMG_001.jpg',
            hasDate: false,
            hasLocation: false
        });
        assert.ok(res3.supplemental.location);
        assert.ok(res3.supplemental.location.value.includes('Tokyo'));
        assert.equal(res3.supplemental.location.source, 'watermark');
        assert.ok(res3.supplemental.dateTime);
        assert.equal(res3.supplemental.dateTime.source, 'watermark');

        // Test 4: Caching
        console.log('Test 4: Caching Verification');
        // Run Test 2 again, should use cache (fetch count would be lower if we tracked it, but we can check DB)
        const cacheRes = await pool.query('SELECT * FROM ai_parse_cache');
        assert.ok(cacheRes.rows.length > 0);
        
        console.log('All tests passed!');
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

runTests();
