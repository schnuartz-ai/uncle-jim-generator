import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:60000,fullyParallel:false,use:{baseURL:'http://127.0.0.1:4173',headless:true},webServer:{command:'node tests/server.mjs',url:'http://127.0.0.1:4173/uncle-jim-generator/',reuseExistingServer:!process.env.CI},projects:[{name:'chromium',use:{browserName:'chromium'}}]});
