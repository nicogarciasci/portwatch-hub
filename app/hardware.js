'use strict';

/* =========================================================================
   PORTWATCH HUB — módulo separado
   ========================================================================= */

/* =========================================================================
   HARDWARE — "roda no meu PC?"
   ========================================================================= */

const HW_TARGETS = {
  low: { thresholds: { gpu: 34, cpu: 42, ram: 50, storage: 55 } },
  high: { thresholds: { gpu: 58, cpu: 60, ram: 60, storage: 70 } },
  1440: { thresholds: { gpu: 70, cpu: 65, ram: 70, storage: 76 } },
  '4k': { thresholds: { gpu: 82, cpu: 75, ram: 80, storage: 82 } },
};

const HW_TARGET_KEYS = {
  low: 'hw.targetLow',
  high: 'hw.targetHigh',
  1440: 'hw.target1440',
  '4k': 'hw.target4k',
};

const HW_KEYS = ['gpu', 'cpu', 'ram', 'storage'];
const HW_WEIGHTS = { gpu: 0.4, cpu: 0.28, ram: 0.18, storage: 0.14 };
const HW_SELECTS = {
  gpu: '#hwGpuSelect',
  cpu: '#hwCpuSelect',
  ram: '#hwRamSelect',
  storage: '#hwStorageSelect',
};

const HW_GROUP_KEYS = {
  nvidia: 'hw.groupNvidia',
  amd: 'hw.groupAmd',
  intel: 'hw.groupIntel',
  igpu: 'hw.groupIgpu',
};

const HW_GPUS = [
  // NVIDIA
  { id: 'rtx5090', group: 'nvidia', label: 'GeForce RTX 5090 32 GB', score: 100, match: /rtx\s*5090/i },
  { id: 'rtx5080', group: 'nvidia', label: 'GeForce RTX 5080 16 GB', score: 86, match: /rtx\s*5080/i },
  { id: 'rtx4090', group: 'nvidia', label: 'GeForce RTX 4090 24 GB', score: 84, match: /rtx\s*4090/i },
  { id: 'rtx4080s', group: 'nvidia', label: 'GeForce RTX 4080 Super 16 GB', score: 80, match: /rtx\s*4080\s*super/i },
  { id: 'rtx5070ti', group: 'nvidia', label: 'GeForce RTX 5070 Ti 16 GB', score: 80, match: /rtx\s*5070\s*ti/i },
  { id: 'rtx4080', group: 'nvidia', label: 'GeForce RTX 4080 16 GB', score: 78, match: /rtx\s*4080/i },
  { id: 'rtx4070tis', group: 'nvidia', label: 'GeForce RTX 4070 Ti Super 16 GB', score: 76, match: /rtx\s*4070\s*ti\s*super/i },
  { id: 'rtx3090', group: 'nvidia', label: 'GeForce RTX 3090 24 GB', score: 76, match: /rtx\s*3090/i },
  { id: 'rtx3080ti', group: 'nvidia', label: 'GeForce RTX 3080 Ti 12 GB', score: 75, match: /rtx\s*3080\s*ti/i },
  { id: 'rtx4070s', group: 'nvidia', label: 'GeForce RTX 4070 Super 12 GB', score: 74, match: /rtx\s*4070\s*super/i },
  { id: 'rtx5070', group: 'nvidia', label: 'GeForce RTX 5070 12 GB', score: 73, match: /rtx\s*5070/i },
  { id: 'rtx3080', group: 'nvidia', label: 'GeForce RTX 3080 10 GB', score: 71, match: /rtx\s*3080/i },
  { id: 'rtx4070', group: 'nvidia', label: 'GeForce RTX 4070 12 GB', score: 69, match: /rtx\s*4070/i },
  { id: 'rtx5060ti', group: 'nvidia', label: 'GeForce RTX 5060 Ti 16 GB', score: 67, match: /rtx\s*5060\s*ti/i },
  { id: 'rtx3070ti', group: 'nvidia', label: 'GeForce RTX 3070 Ti 8 GB', score: 66, match: /rtx\s*3070\s*ti/i },
  { id: 'rtx2080ti', group: 'nvidia', label: 'GeForce RTX 2080 Ti 11 GB', score: 66, match: /rtx\s*2080\s*ti/i },
  { id: 'rtx3070', group: 'nvidia', label: 'GeForce RTX 3070 8 GB', score: 64, match: /rtx\s*3070/i },
  { id: 'rtx4060ti', group: 'nvidia', label: 'GeForce RTX 4060 Ti 8 GB', score: 63, match: /rtx\s*4060\s*ti/i },
  { id: 'rtx2080s', group: 'nvidia', label: 'GeForce RTX 2080 Super 8 GB', score: 62, match: /rtx\s*2080\s*super/i },
  { id: 'rtx5060', group: 'nvidia', label: 'GeForce RTX 5060 8 GB', score: 62, match: /rtx\s*5060/i },
  { id: 'rtx3060ti', group: 'nvidia', label: 'GeForce RTX 3060 Ti 8 GB', score: 61, match: /rtx\s*3060\s*ti/i },
  { id: 'rtx2070s', group: 'nvidia', label: 'GeForce RTX 2070 Super 8 GB', score: 59, match: /rtx\s*2070\s*super/i },
  { id: 'rtx4060', group: 'nvidia', label: 'GeForce RTX 4060 8 GB', score: 58, match: /rtx\s*4060/i },
  { id: 'rtx2060s', group: 'nvidia', label: 'GeForce RTX 2060 Super 8 GB', score: 56, match: /rtx\s*2060\s*super/i },
  { id: 'gtx1080ti', group: 'nvidia', label: 'GeForce GTX 1080 Ti 11 GB', score: 56, match: /gtx\s*1080\s*ti/i },
  { id: 'rtx3060', group: 'nvidia', label: 'GeForce RTX 3060 12 GB', score: 54, match: /rtx\s*3060/i },
  { id: 'rtx2060', group: 'nvidia', label: 'GeForce RTX 2060 6 GB', score: 51, match: /rtx\s*2060/i },
  { id: 'gtx1080', group: 'nvidia', label: 'GeForce GTX 1080 8 GB', score: 49, match: /gtx\s*1080/i },
  { id: 'gtx1660s', group: 'nvidia', label: 'GeForce GTX 1660 Super 6 GB', score: 46, match: /gtx\s*1660\s*super/i },
  { id: 'gtx1660ti', group: 'nvidia', label: 'GeForce GTX 1660 Ti 6 GB', score: 45, match: /gtx\s*1660\s*ti/i },
  { id: 'gtx1070', group: 'nvidia', label: 'GeForce GTX 1070 8 GB', score: 45, match: /gtx\s*1070/i },
  { id: 'gtx1660', group: 'nvidia', label: 'GeForce GTX 1660 6 GB', score: 44, match: /gtx\s*1660/i },
  { id: 'rtx3050', group: 'nvidia', label: 'GeForce RTX 3050 8 GB', score: 44, match: /rtx\s*3050/i },
  { id: 'gtx1650s', group: 'nvidia', label: 'GeForce GTX 1650 Super 4 GB', score: 42, match: /gtx\s*1650\s*super/i },
  { id: 'gtx1060', group: 'nvidia', label: 'GeForce GTX 1060 6 GB', score: 40, match: /gtx\s*1060(?!.*3\s*gb)/i },
  { id: 'gtx1650', group: 'nvidia', label: 'GeForce GTX 1650 4 GB', score: 36, match: /gtx\s*1650/i },
  { id: 'gtx1060-3gb', group: 'nvidia', label: 'GeForce GTX 1060 3 GB', score: 35, match: /gtx\s*1060.*3\s*gb/i },
  { id: 'gtx1050ti', group: 'nvidia', label: 'GeForce GTX 1050 Ti 4 GB', score: 32, match: /gtx\s*1050\s*ti/i },
  { id: 'gt1030', group: 'nvidia', label: 'GeForce GT 1030 2 GB', score: 18, match: /gt\s*1030/i },
  // AMD
  { id: 'rx7900xtx', group: 'amd', label: 'Radeon RX 7900 XTX 24 GB', score: 84, match: /rx\s*7900\s*xtx/i },
  { id: 'rx9070xt', group: 'amd', label: 'Radeon RX 9070 XT 16 GB', score: 79, match: /rx\s*9070\s*xt/i },
  { id: 'rx7900xt', group: 'amd', label: 'Radeon RX 7900 XT 20 GB', score: 79, match: /rx\s*7900\s*xt/i },
  { id: 'rx9070', group: 'amd', label: 'Radeon RX 9070 16 GB', score: 74, match: /rx\s*9070/i },
  { id: 'rx7900gre', group: 'amd', label: 'Radeon RX 7900 GRE 16 GB', score: 74, match: /rx\s*7900\s*gre/i },
  { id: 'rx6950xt', group: 'amd', label: 'Radeon RX 6950 XT 16 GB', score: 74, match: /rx\s*6950\s*xt/i },
  { id: 'rx7800xt', group: 'amd', label: 'Radeon RX 7800 XT 16 GB', score: 72, match: /rx\s*7800\s*xt/i },
  { id: 'rx6900xt', group: 'amd', label: 'Radeon RX 6900 XT 16 GB', score: 72, match: /rx\s*6900\s*xt/i },
  { id: 'rx6800xt', group: 'amd', label: 'Radeon RX 6800 XT 16 GB', score: 70, match: /rx\s*6800\s*xt/i },
  { id: 'rx7700xt', group: 'amd', label: 'Radeon RX 7700 XT 12 GB', score: 67, match: /rx\s*7700\s*xt/i },
  { id: 'rx6800', group: 'amd', label: 'Radeon RX 6800 16 GB', score: 65, match: /rx\s*6800/i },
  { id: 'rx6750xt', group: 'amd', label: 'Radeon RX 6750 XT 12 GB', score: 63, match: /rx\s*6750\s*xt/i },
  { id: 'rx7600xt', group: 'amd', label: 'Radeon RX 7600 XT 16 GB', score: 62, match: /rx\s*7600\s*xt/i },
  { id: 'rx6700xt', group: 'amd', label: 'Radeon RX 6700 XT 12 GB', score: 60, match: /rx\s*6700\s*xt/i },
  { id: 'rx7600', group: 'amd', label: 'Radeon RX 7600 8 GB', score: 58, match: /rx\s*7600/i },
  { id: 'rx6650xt', group: 'amd', label: 'Radeon RX 6650 XT 8 GB', score: 55, match: /rx\s*6650\s*xt/i },
  { id: 'rx6600xt', group: 'amd', label: 'Radeon RX 6600 XT 8 GB', score: 54, match: /rx\s*6600\s*xt/i },
  { id: 'rx5700xt', group: 'amd', label: 'Radeon RX 5700 XT 8 GB', score: 53, match: /rx\s*5700\s*xt/i },
  { id: 'rx6600', group: 'amd', label: 'Radeon RX 6600 8 GB', score: 50, match: /rx\s*6600/i },
  { id: 'rx5600xt', group: 'amd', label: 'Radeon RX 5600 XT 6 GB', score: 48, match: /rx\s*5600\s*xt/i },
  { id: 'vega64', group: 'amd', label: 'Radeon RX Vega 64 8 GB', score: 45, match: /vega\s*64/i },
  { id: 'rx6500xt', group: 'amd', label: 'Radeon RX 6500 XT 4 GB', score: 37, match: /rx\s*6500\s*xt/i },
  { id: 'rx580', group: 'amd', label: 'Radeon RX 580 8 GB', score: 35, match: /rx\s*580(?!\s*2048)/i },
  { id: 'rx5802048', group: 'amd', label: 'Radeon RX 580 2048SP', score: 32, match: /rx\s*580\s*2048|2048\s*sp/i },
  { id: 'rx570', group: 'amd', label: 'Radeon RX 570 8 GB', score: 32, match: /rx\s*570/i },
  // Intel
  { id: 'arcb580', group: 'intel', label: 'Intel Arc B580 12 GB', score: 63, match: /arc.*b580/i },
  { id: 'arcb570', group: 'intel', label: 'Intel Arc B570 10 GB', score: 58, match: /arc.*b570/i },
  { id: 'arca770', group: 'intel', label: 'Intel Arc A770 16 GB', score: 55, match: /arc.*a770/i },
  { id: 'arca750', group: 'intel', label: 'Intel Arc A750 8 GB', score: 53, match: /arc.*a750/i },
  { id: 'arca380', group: 'intel', label: 'Intel Arc A380 6 GB', score: 35, match: /arc.*a380/i },
  // Integradas
  { id: 'radeon780m', group: 'igpu', label: 'Radeon 780M (iGPU)', score: 27, match: /radeon\s*780m/i },
  { id: 'irisxe', group: 'igpu', label: 'Intel Iris Xe (iGPU)', score: 20, match: /iris.*xe/i },
  { id: 'vega8', group: 'igpu', label: 'Radeon Vega 8 (iGPU)', score: 17, match: /vega\s*8/i },
  { id: 'radeon-graphics', group: 'igpu', label: 'Radeon Graphics (iGPU)', score: 15, match: /radeon.*graphics/i },
  { id: 'uhd630', group: 'igpu', label: 'Intel UHD 630 (iGPU)', score: 12, match: /uhd.*630/i },
  { id: 'intel-graphics', group: 'igpu', label: 'Intel UHD Graphics (iGPU)', score: 10, match: /intel.*(uhd|hd)\s*graphics/i },
];

const HW_CPUS = [
  // AMD
  { id: 'r7-9800x3d', group: 'amd', label: 'AMD Ryzen 7 9800X3D', score: 100, match: /ryzen\s*7\s*9800x3d/i },
  { id: 'r9-9950x3d', group: 'amd', label: 'AMD Ryzen 9 9950X3D', score: 99, match: /ryzen\s*9\s*9950x3d/i },
  { id: 'r7-7800x3d', group: 'amd', label: 'AMD Ryzen 7 7800X3D', score: 93, match: /ryzen\s*7\s*7800x3d/i },
  { id: 'r7-9700x', group: 'amd', label: 'AMD Ryzen 7 9700X', score: 87, match: /ryzen\s*7\s*9700x/i },
  { id: 'r7-5800x3d', group: 'amd', label: 'AMD Ryzen 7 5800X3D', score: 85, match: /ryzen\s*7\s*5800x3d/i },
  { id: 'r7-5700x3d', group: 'amd', label: 'AMD Ryzen 7 5700X3D', score: 82, match: /ryzen\s*7\s*5700x3d/i },
  { id: 'r7-7700x', group: 'amd', label: 'AMD Ryzen 7 7700X', score: 82, match: /ryzen\s*7\s*7700x/i },
  { id: 'r5-7600x', group: 'amd', label: 'AMD Ryzen 5 7600X', score: 80, match: /ryzen\s*5\s*7600x/i },
  { id: 'r5-7600', group: 'amd', label: 'AMD Ryzen 5 7600', score: 78, match: /ryzen\s*5\s*7600/i },
  { id: 'r7-5800x', group: 'amd', label: 'AMD Ryzen 7 5800X', score: 72, match: /ryzen\s*7\s*5800x/i },
  { id: 'r9-5900x', group: 'amd', label: 'AMD Ryzen 9 5900X', score: 70, match: /ryzen\s*9\s*5900x/i },
  { id: 'r7-5700x', group: 'amd', label: 'AMD Ryzen 7 5700X', score: 68, match: /ryzen\s*7\s*5700x/i },
  { id: 'r7-8700g', group: 'amd', label: 'AMD Ryzen 7 8700G', score: 65, match: /ryzen\s*7\s*8700g/i },
  { id: 'r5-5600x', group: 'amd', label: 'AMD Ryzen 5 5600X', score: 62, match: /ryzen\s*5\s*5600x/i },
  { id: 'r5-5600', group: 'amd', label: 'AMD Ryzen 5 5600', score: 60, match: /ryzen\s*5\s*5600(?!\s*[gx])/i },
  { id: 'r9-3900x', group: 'amd', label: 'AMD Ryzen 9 3900X', score: 56, match: /ryzen\s*9\s*3900x/i },
  { id: 'r7-5700g', group: 'amd', label: 'AMD Ryzen 7 5700G', score: 56, match: /ryzen\s*7\s*5700g/i },
  { id: 'r5-5600g', group: 'amd', label: 'AMD Ryzen 5 5600G', score: 52, match: /ryzen\s*5\s*5600g/i },
  { id: 'r7-3700x', group: 'amd', label: 'AMD Ryzen 7 3700X', score: 52, match: /ryzen\s*7\s*3700x/i },
  { id: 'r5-5500', group: 'amd', label: 'AMD Ryzen 5 5500', score: 52, match: /ryzen\s*5\s*5500/i },
  { id: 'r5-3600', group: 'amd', label: 'AMD Ryzen 5 3600', score: 50, match: /ryzen\s*5\s*3600/i },
  { id: 'r5-8500g', group: 'amd', label: 'AMD Ryzen 5 8500G', score: 50, match: /ryzen\s*5\s*8500g/i },
  { id: 'r7-2700x', group: 'amd', label: 'AMD Ryzen 7 2700X', score: 46, match: /ryzen\s*7\s*2700x/i },
  { id: 'r5-2600', group: 'amd', label: 'AMD Ryzen 5 2600', score: 42, match: /ryzen\s*5\s*2600/i },
  { id: 'r3-4350g', group: 'amd', label: 'AMD Ryzen 3 PRO 4350G', score: 38, match: /4350g/i },
  { id: 'r5-1600', group: 'amd', label: 'AMD Ryzen 5 1600', score: 36, match: /ryzen\s*5\s*1600/i },
  { id: 'r5-3400g', group: 'amd', label: 'AMD Ryzen 5 3400G', score: 32, match: /3400g/i },
  { id: 'r3-3200g', group: 'amd', label: 'AMD Ryzen 3 3200G', score: 30, match: /3200g/i },
  // Intel
  { id: 'i9-14900k', group: 'intel', label: 'Intel Core i9-14900K', score: 90, match: /14900/i },
  { id: 'i9-13900k', group: 'intel', label: 'Intel Core i9-13900K', score: 89, match: /13900/i },
  { id: 'i7-14700k', group: 'intel', label: 'Intel Core i7-14700K', score: 88, match: /14700/i },
  { id: 'ultra9-285k', group: 'intel', label: 'Intel Core Ultra 9 285K', score: 88, match: /285k/i },
  { id: 'i7-13700k', group: 'intel', label: 'Intel Core i7-13700K', score: 86, match: /13700/i },
  { id: 'i5-14600k', group: 'intel', label: 'Intel Core i5-14600K', score: 85, match: /14600/i },
  { id: 'ultra7-265k', group: 'intel', label: 'Intel Core Ultra 7 265K', score: 85, match: /265k/i },
  { id: 'i5-13600k', group: 'intel', label: 'Intel Core i5-13600K', score: 82, match: /13600/i },
  { id: 'ultra5-245k', group: 'intel', label: 'Intel Core Ultra 5 245K', score: 80, match: /245k/i },
  { id: 'i9-12900k', group: 'intel', label: 'Intel Core i9-12900K', score: 80, match: /12900/i },
  { id: 'i7-12700k', group: 'intel', label: 'Intel Core i7-12700K', score: 78, match: /12700/i },
  { id: 'i5-12600k', group: 'intel', label: 'Intel Core i5-12600K', score: 74, match: /12600/i },
  { id: 'i5-14400f', group: 'intel', label: 'Intel Core i5-14400F', score: 70, match: /14400/i },
  { id: 'i5-13400f', group: 'intel', label: 'Intel Core i5-13400F', score: 68, match: /13400/i },
  { id: 'i5-12400f', group: 'intel', label: 'Intel Core i5-12400F', score: 66, match: /12400/i },
  { id: 'i3-14100f', group: 'intel', label: 'Intel Core i3-14100F', score: 63, match: /14100/i },
  { id: 'i9-11900k', group: 'intel', label: 'Intel Core i9-11900K', score: 62, match: /11900/i },
  { id: 'i3-13100f', group: 'intel', label: 'Intel Core i3-13100F', score: 60, match: /13100/i },
  { id: 'i7-11700k', group: 'intel', label: 'Intel Core i7-11700K', score: 60, match: /11700/i },
  { id: 'i3-12100f', group: 'intel', label: 'Intel Core i3-12100F', score: 58, match: /12100/i },
  { id: 'i9-10900k', group: 'intel', label: 'Intel Core i9-10900K', score: 58, match: /10900/i },
  { id: 'i7-10700k', group: 'intel', label: 'Intel Core i7-10700K', score: 56, match: /10700/i },
  { id: 'i5-11400f', group: 'intel', label: 'Intel Core i5-11400F', score: 54, match: /11400/i },
  { id: 'i9-9900k', group: 'intel', label: 'Intel Core i9-9900K', score: 52, match: /9900/i },
  { id: 'i7-8700k', group: 'intel', label: 'Intel Core i7-8700K', score: 50, match: /8700/i },
  { id: 'i5-10400f', group: 'intel', label: 'Intel Core i5-10400F', score: 48, match: /10400/i },
  { id: 'i3-10100f', group: 'intel', label: 'Intel Core i3-10100F', score: 45, match: /10100/i },
  { id: 'i5-9600k', group: 'intel', label: 'Intel Core i5-9600K', score: 44, match: /9600/i },
  { id: 'i5-9400f', group: 'intel', label: 'Intel Core i5-9400F', score: 44, match: /9400/i },
  { id: 'i7-7700k', group: 'intel', label: 'Intel Core i7-7700K', score: 40, match: /7700k/i },
  { id: 'i5-8400', group: 'intel', label: 'Intel Core i5-8400', score: 38, match: /8400/i },
  { id: 'i3-8100', group: 'intel', label: 'Intel Core i3-8100', score: 32, match: /8100/i },
];

const HW_RAM = [
  { id: '8-ddr3-1600', label: '8 GB DDR3 1600', score: 25 },
  { id: '8-ddr4-2400', label: '8 GB DDR4 2400', score: 33 },
  { id: '8-ddr4-3200', label: '8 GB DDR4 3200', score: 41 },
  { id: '16-ddr3-1600', label: '16 GB DDR3 1600', score: 47 },
  { id: '16-ddr4-2400', label: '16 GB DDR4 2400', score: 55 },
  { id: '16-ddr4-3200', label: '16 GB DDR4 3200', score: 63 },
  { id: '16-ddr5-4800', label: '16 GB DDR5 4800', score: 72 },
  { id: '16-ddr5-5600', label: '16 GB DDR5 5600', score: 72 },
  { id: '32-ddr4-3200', label: '32 GB DDR4 3200', score: 75 },
  { id: '32-ddr4-3600', label: '32 GB DDR4 3600', score: 79 },
  { id: '32-ddr5-5600', label: '32 GB DDR5 5600', score: 84 },
  { id: '32-ddr5-6000', label: '32 GB DDR5 6000', score: 84 },
  { id: '64-ddr5-6000', label: '64 GB DDR5 6000', score: 92 },
  { id: '128-ddr5-6000', label: '128 GB DDR5 6000', score: 98 },
];

const HW_STORAGE = [
  { id: 'hdd-500', label: 'HDD · 500 GB', score: 34 },
  { id: 'hdd-1tb', label: 'HDD · 1 TB', score: 38 },
  { id: 'ssd-100', label: 'SSD SATA · 100 GB', score: 58 },
  { id: 'ssd-250', label: 'SSD SATA · 250 GB', score: 70 },
  { id: 'ssd-500', label: 'SSD SATA · 500 GB', score: 78 },
  { id: 'ssd-1tb', label: 'SSD SATA · 1 TB', score: 80 },
  { id: 'nvme3-500', label: 'NVMe Gen 3 · 500 GB', score: 86 },
  { id: 'nvme4-500', label: 'NVMe Gen 4 · 500 GB', score: 90 },
  { id: 'nvme4-1tb', label: 'NVMe Gen 4 · 1 TB', score: 92 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function capKey(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function gbFromBytes(bytes) {
  return (Number(bytes) || 0) / 1024 ** 3;
}

function matchEntry(list, name) {
  const text = String(name || '');
  return list.find((item) => item.match && item.match.test(text)) || null;
}

function closestEntry(list, score) {
  let best = list[0];
  let distance = Infinity;
  for (const item of list) {
    const current = Math.abs(item.score - score);
    if (current < distance) {
      distance = current;
      best = item;
    }
  }
  return best;
}

function autoGpuScore(gpu) {
  if (!gpu) return 0;
  const name = String(gpu.name || '');
  const hit = matchEntry(HW_GPUS, name);
  let score;
  if (hit) {
    score = hit.score;
  } else {
    const vram = gbFromBytes(gpu.vramBytes);
    if (vram >= 24) score = 78;
    else if (vram >= 16) score = 70;
    else if (vram >= 12) score = 60;
    else if (vram >= 8) score = 46;
    else if (vram >= 6) score = 38;
    else if (vram >= 4) score = 28;
    else if (vram >= 2) score = 16;
    else score = 8;
  }
  const integrated = hit && hit.group === 'igpu';
  if (!integrated && /laptop|mobile|max-q/i.test(name)) score = Math.round(score * 0.85);
  return clamp(score, 1, 100);
}

function autoCpuScore(cpu) {
  if (!cpu) return 0;
  const hit = matchEntry(HW_CPUS, cpu.name);
  if (hit) return hit.score;
  const threads = Number(cpu.threads) || 1;
  const cores = Number(cpu.cores) || 1;
  const clock = Number(cpu.maxClockMhz) || 3000;
  return Math.round(clamp(threads * 3 + cores * 2 + (clock - 2500) / 100, 10, 100));
}

function ramTotalBytes(ram) {
  if (!ram) return 0;
  const modules = ram.modules || [];
  const moduleBytes = modules.reduce((sum, module) => sum + (Number(module.capacityBytes) || 0), 0);
  return moduleBytes || Number(ram.totalBytes) || 0;
}

function autoRamScore(ram) {
  if (!ram || !ram.totalBytes) return 0;
  const total = Math.ceil(gbFromBytes(ramTotalBytes(ram)));
  let base;
  if (total >= 128) base = 78;
  else if (total >= 64) base = 72;
  else if (total >= 32) base = 64;
  else if (total >= 24) base = 58;
  else if (total >= 16) base = 52;
  else if (total >= 12) base = 40;
  else base = 30;
  const speed = Number(ram.speedMhz) || 2133;
  const speedBonus = clamp((speed - 2133) / 100, 0, 16);
  const type = String(ram.type || '').toUpperCase();
  const typeBonus = type === 'DDR5' ? 4 : type === 'DDR3' ? -5 : 0;
  return Math.round(clamp(base + speedBonus + typeBonus, 5, 100));
}

function storageDrive(data) {
  const drives = (data && data.drives) || [];
  const gameDrive = drives.find((drive) => (drive.roles || []).includes('downloads'));
  if (gameDrive) return gameDrive;
  return drives.slice().sort((a, b) => (b.freeBytes || 0) - (a.freeBytes || 0))[0] || null;
}

function storageMediaLabel(drive) {
  if (!drive) return t('hw.unknown');
  const media = String(drive.mediaType || '').toLowerCase();
  const bus = String(drive.busType || '').toLowerCase();
  const model = String(drive.model || '');
  if (media.includes('ssd')) {
    return t(bus.includes('nvme') || /nvme/i.test(model) ? 'hw.mediaNvme' : 'hw.mediaSsd');
  }
  return t('hw.mediaHdd');
}

function autoStorageScore(data) {
  const drive = storageDrive(data);
  if (!drive) return 0;
  const free = gbFromBytes(drive.freeBytes);
  const media = String(drive.mediaType || '').toLowerCase();
  const bus = String(drive.busType || '').toLowerCase();
  const model = String(drive.model || '');
  const nvme = bus.includes('nvme') || /nvme/i.test(model);
  let score;
  if (media.includes('ssd')) {
    if (free >= 500) score = 78;
    else if (free >= 350) score = 74;
    else if (free >= 250) score = 70;
    else if (free >= 150) score = 65;
    else if (free >= 100) score = 58;
    else score = 48;
    if (nvme) score += 10;
  } else if (free >= 500) score = 38;
  else if (free >= 250) score = 34;
  else if (free >= 150) score = 28;
  else if (free >= 100) score = 22;
  else score = 15;
  return Math.round(clamp(score, 0, 95));
}

function autoHardwareScores(data) {
  return {
    gpu: autoGpuScore(data && data.gpu),
    cpu: autoCpuScore(data && data.cpu),
    ram: autoRamScore(data && data.ram),
    storage: autoStorageScore(data),
  };
}

function autoHardwareParts(data) {
  const gpu = data && data.gpu;
  const cpu = data && data.cpu;
  const ram = data && data.ram;
  const drive = storageDrive(data);
  const ramGb = Math.ceil(gbFromBytes(ramTotalBytes(ram)));
  const vramGb = Math.round(gbFromBytes(gpu && gpu.vramBytes));

  return {
    gpu: {
      name: (gpu && gpu.name) || t('hw.unknown'),
      meta: gpu ? t('hw.vram', { gb: vramGb }) : '—',
    },
    cpu: {
      name: (cpu && cpu.name) || t('hw.unknown'),
      meta: cpu
        ? `${cpu.cores}C/${cpu.threads}T · ${(Number(cpu.maxClockMhz) / 1000).toFixed(1)} GHz`
        : '—',
    },
    ram: {
      name:
        ram && ram.totalBytes
          ? `${ramGb} GB ${ram.type || 'RAM'}${ram.speedMhz ? ` · ${ram.speedMhz} MHz` : ''}`
          : t('hw.unknown'),
      meta: ram && ram.modules && ram.modules.length ? t('hw.modules', { count: ram.modules.length }) : '—',
    },
    storage: {
      name: drive ? `${drive.letter}: ${storageMediaLabel(drive)}` : t('hw.unknown'),
      meta: drive ? t('hw.free', { free: fmtBytes(drive.freeBytes) }) : '—',
    },
  };
}

function manualEntry(list, id, fallbackId) {
  return list.find((item) => item.id === id) || list.find((item) => item.id === fallbackId) || list[0];
}

function manualHardwareModel() {
  const selection = state.hw.selection;
  const gpu = manualEntry(HW_GPUS, selection.gpu, 'rx580');
  const cpu = manualEntry(HW_CPUS, selection.cpu, 'r3-4350g');
  const ram = manualEntry(HW_RAM, selection.ram, '16-ddr4-2400');
  const storage = manualEntry(HW_STORAGE, selection.storage, 'ssd-500');
  const meta = t('hw.manualBadge');
  return {
    scores: { gpu: gpu.score, cpu: cpu.score, ram: ram.score, storage: storage.score },
    parts: {
      gpu: { name: gpu.label, meta },
      cpu: { name: cpu.label, meta },
      ram: { name: ram.label, meta },
      storage: { name: storage.label, meta },
    },
  };
}

function initializeHardwareSelection(data) {
  const scores = autoHardwareScores(data);
  const gpuHit = matchEntry(HW_GPUS, data && data.gpu && data.gpu.name);
  const cpuHit = matchEntry(HW_CPUS, data && data.cpu && data.cpu.name);
  state.hw.selection = {
    gpu: (gpuHit || closestEntry(HW_GPUS, scores.gpu)).id,
    cpu: (cpuHit || closestEntry(HW_CPUS, scores.cpu)).id,
    ram: closestEntry(HW_RAM, scores.ram).id,
    storage: closestEntry(HW_STORAGE, scores.storage).id,
  };
}

function hardwareList(key) {
  if (key === 'gpu') return HW_GPUS;
  if (key === 'cpu') return HW_CPUS;
  if (key === 'ram') return HW_RAM;
  return HW_STORAGE;
}

function appendHardwareOption(parent, item) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  parent.appendChild(option);
}

function buildHardwareSelects() {
  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select || select.dataset.filled === '1') continue;
    select.dataset.filled = '1';
    select.textContent = '';
    const list = hardwareList(key);
    if (key !== 'gpu' && key !== 'cpu') {
      for (const item of list) appendHardwareOption(select, item);
      continue;
    }
    const groups = new Map();
    for (const item of list) {
      const groupId = item.group || 'other';
      let group = groups.get(groupId);
      if (!group) {
        group = document.createElement('optgroup');
        group.dataset.group = groupId;
        group.label = t(HW_GROUP_KEYS[groupId] || groupId);
        select.appendChild(group);
        groups.set(groupId, group);
      }
      appendHardwareOption(group, item);
    }
  }

  if (!state.hw.selection.gpu) state.hw.selection.gpu = 'rx580';
  if (!state.hw.selection.cpu) state.hw.selection.cpu = 'r3-4350g';
  if (!state.hw.selection.ram) state.hw.selection.ram = '16-ddr4-2400';
  if (!state.hw.selection.storage) state.hw.selection.storage = 'ssd-500';
}

function syncHardwareSelectGroups() {
  $$('select.hw-select optgroup[data-group]').forEach((group) => {
    const key = HW_GROUP_KEYS[group.dataset.group];
    if (key) group.label = t(key);
  });
}

async function ensureHardware(refresh = false) {
  if (state.hw.loading) return;
  if (state.hw.data && !refresh) {
    renderHardware();
    return;
  }

  state.hw.loading = true;
  state.hw.error = null;
  renderHardware();

  try {
    let data;
    if (IS_DESKTOP) {
      data = await window.portwatch.hardware(refresh);
    } else {
      await sleep(520);
      data = mockHardware();
    }
    if (!data) throw new Error('empty');
    state.hw.data = data;
    if (!state.hw.manual) initializeHardwareSelection(data);
  } catch (err) {
    state.hw.error = String(err && err.message ? err.message : err);
  } finally {
    state.hw.loading = false;
    renderHardware();
  }
}

function fillHardwareParts(parts) {
  const set = (nameId, metaId, part) => {
    const name = document.getElementById(nameId);
    const meta = document.getElementById(metaId);
    if (name) {
      name.textContent = part ? part.name : '—';
      name.title = part ? part.name : '';
    }
    if (meta) {
      meta.textContent = part ? part.meta : '—';
      meta.title = part ? part.meta : '';
    }
  };
  set('hwGpuName', 'hwGpuMeta', parts && parts.gpu);
  set('hwCpuName', 'hwCpuMeta', parts && parts.cpu);
  set('hwRamName', 'hwRamMeta', parts && parts.ram);
  set('hwStorageName', 'hwStorageMeta', parts && parts.storage);
}

function resetHardwareBars() {
  for (const key of HW_KEYS) {
    const fill = document.getElementById(`hw${capKey(key)}Fill`);
    const marker = document.getElementById(`hw${capKey(key)}Need`);
    const score = document.getElementById(`hw${capKey(key)}Score`);
    const needText = document.getElementById(`hw${capKey(key)}NeedText`);
    const bar = fill && fill.closest('.hw-bar');
    if (fill) fill.style.width = '0%';
    if (marker) marker.style.left = '0%';
    if (score) score.textContent = '—';
    if (needText) needText.textContent = '—';
    if (bar) bar.classList.remove('state-ok', 'state-warn', 'state-bad');
  }
}

function renderHardwareResult(model) {
  const target = HW_TARGETS[state.hw.target] || HW_TARGETS.low;
  const ratios = {};
  let weighted = 0;

  for (const key of HW_KEYS) {
    const score = Math.round(clamp(Number(model.scores[key]) || 0, 0, 100));
    const need = target.thresholds[key];
    ratios[key] = need ? score / need : 0;
    weighted += (need ? score / need : 0) * HW_WEIGHTS[key];

    const fill = document.getElementById(`hw${capKey(key)}Fill`);
    const marker = document.getElementById(`hw${capKey(key)}Need`);
    const scoreEl = document.getElementById(`hw${capKey(key)}Score`);
    const needText = document.getElementById(`hw${capKey(key)}NeedText`);
    const bar = fill && fill.closest('.hw-bar');

    if (fill) fill.style.width = `${score}%`;
    if (marker) marker.style.left = `${Math.min(100, need)}%`;
    if (scoreEl) scoreEl.innerHTML = `${score}<em>/100</em>`;
    if (needText) needText.textContent = t('hw.need', { need });
    if (bar) {
      bar.classList.remove('state-ok', 'state-warn', 'state-bad');
      bar.classList.add(ratios[key] >= 1 ? 'state-ok' : ratios[key] >= 0.75 ? 'state-warn' : 'state-bad');
    }
  }

  const minRatio = Math.min(...HW_KEYS.map((key) => ratios[key]));
  let kind = 'below';
  if (minRatio >= 1) kind = 'ready';
  else if (minRatio >= 0.75 && weighted >= 0.82) kind = 'adjust';

  const verdict = $('#hwVerdict');
  if (verdict) {
    verdict.classList.remove('is-ready', 'is-adjust', 'is-below');
    verdict.classList.add(`is-${kind}`);
  }

  const targetName = t(HW_TARGET_KEYS[state.hw.target] || 'hw.targetLow');
  const titleKey = kind === 'ready' ? 'hw.verdictReady' : kind === 'adjust' ? 'hw.verdictAdjust' : 'hw.verdictBelow';
  const textKey =
    kind === 'ready'
      ? 'hw.verdictReadyText'
      : kind === 'adjust'
        ? 'hw.verdictAdjustText'
        : 'hw.verdictBelowText';

  const title = $('#hwVerdictTitle');
  const text = $('#hwVerdictText');
  const pct = $('#hwVerdictPct');
  const use = $('#hwVerdictUse');
  if (title) title.textContent = t(titleKey);
  if (text) text.textContent = t(textKey, { target: targetName });
  if (pct) pct.textContent = t('hw.ofTarget', { pct: Math.round(weighted * 100) });
  if (use) use.setAttribute('href', kind === 'ready' ? '#i-check' : kind === 'adjust' ? '#i-sliders' : '#i-alert');
}

function renderHardware() {
  const view = $('.view[data-view="hardware"]');
  if (!view) return;

  syncHardwareSelectGroups();

  const data = state.hw.data;
  const loading = state.hw.loading;
  const manual = state.hw.manual;
  const source = $('#hwSource');
  if (source) {
    source.classList.toggle('is-manual', manual);
    source.textContent = manual
      ? t('hw.manualBadge')
      : loading
        ? t('hw.refreshing')
        : data
          ? t('hw.detected')
          : t('hw.detectFailed');
  }

  const errorEl = $('#hwError');
  if (errorEl) {
    errorEl.hidden = !state.hw.error;
    errorEl.textContent = state.hw.error ? t('hw.detectFailed') : '';
  }

  const toggle = $('#hwAutoToggle');
  if (toggle) toggle.checked = !manual;

  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select) continue;
    if (state.hw.selection[key]) select.value = state.hw.selection[key];
  }

  $$('.hw-target').forEach((btn) => {
    const active = btn.dataset.target === state.hw.target;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const refreshBtn = $('#hwRefreshBtn');
  if (refreshBtn) {
    refreshBtn.disabled = loading;
    refreshBtn.classList.toggle('is-busy', loading);
  }

  const model = manual ? manualHardwareModel() : data ? { scores: autoHardwareScores(data), parts: autoHardwareParts(data) } : null;

  if (!model) {
    fillHardwareParts(null);
    resetHardwareBars();
    const verdict = $('#hwVerdict');
    if (verdict) verdict.classList.remove('is-ready', 'is-adjust', 'is-below');
    const title = $('#hwVerdictTitle');
    const text = $('#hwVerdictText');
    const pct = $('#hwVerdictPct');
    const use = $('#hwVerdictUse');
    if (title) title.textContent = loading ? t('hw.loading') : t('hw.detectFailed');
    if (text) text.textContent = '—';
    if (pct) pct.textContent = '—';
    if (use) use.setAttribute('href', '#i-sliders');
    return;
  }

  fillHardwareParts(model.parts);
  renderHardwareResult(model);
}

function bindHardware() {
  buildHardwareSelects();

  const toggle = $('#hwAutoToggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.hw.manual = !toggle.checked;
      if (state.hw.data) initializeHardwareSelection(state.hw.data);
      renderHardware();
    });
  }

  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select) continue;
    select.addEventListener('change', () => {
      state.hw.selection[key] = select.value;
      state.hw.manual = true;
      const auto = $('#hwAutoToggle');
      if (auto) auto.checked = false;
      renderHardware();
    });
  }

  $$('.hw-target').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.hw.target = btn.dataset.target;
      renderHardware();
      blip({ freq: 980, dur: 0.04, gain: 0.012, type: 'triangle' });
    });
  });

  const refresh = $('#hwRefreshBtn');
  if (refresh) {
    refresh.addEventListener('click', () => {
      state.hw.manual = false;
      ensureHardware(true);
    });
  }

  renderHardware();
}

function mockHardware() {
  const gb = 1024 ** 3;
  return {
    detectedAt: new Date().toISOString(),
    os: { platform: 'win32', release: '10.0.19045', label: 'Windows 10' },
    cpu: {
      name: 'AMD Ryzen 5 5600 6-Core Processor',
      cores: 6,
      threads: 12,
      maxClockMhz: 4400,
    },
    gpu: {
      name: 'NVIDIA GeForce RTX 3060',
      driver: '31.0.15.3623',
      vramBytes: 12 * gb,
      adapters: [{ name: 'NVIDIA GeForce RTX 3060', driver: '31.0.15.3623', vramBytes: 12 * gb }],
    },
    ram: {
      totalBytes: 16 * gb,
      type: 'DDR4',
      speedMhz: 3200,
      modules: [
        { capacityBytes: 8 * gb, speedMhz: 3200, type: 'DDR4' },
        { capacityBytes: 8 * gb, speedMhz: 3200, type: 'DDR4' },
      ],
    },
    drives: [
      { root: 'C:\\', letter: 'C', freeBytes: 48 * gb, totalBytes: 512 * gb, mediaType: 'SSD', busType: 'NVMe', model: 'Generic NVMe SSD', roles: ['disk'] },
      { root: 'D:\\', letter: 'D', freeBytes: 300 * gb, totalBytes: 1000 * gb, mediaType: 'SSD', busType: 'SATA', model: 'Generic SATA SSD', roles: ['project', 'downloads', 'disk'] },
    ],
    warnings: [],
  };
}
