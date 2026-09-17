/**
 * 🧩 PuzzleRadar — Google Apps Script (Versão Mestre com Multi-Chain & Webhook 10 Colunas)
 * Planilha ID: 1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg
 * Webhook URL: https://script.google.com/macros/s/AKfycbxx1VUWthDRiWJuLTFoD30dxK7-BeDDHhoqJ9hDWdCbjEurDf19-nttaQGvZIL4g0Q/exec
 */

function popularPlanilhaPuzzles1000BTC() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ─── ABA 1: PUZZLES MESTRE 1000 BTC (160 CARTEIRAS REAIS) ───
  let sheetPuzzles = ss.getSheetByName("Puzzles_1000BTC");
  if (!sheetPuzzles) sheetPuzzles = ss.insertSheet("Puzzles_1000BTC");
  sheetPuzzles.clear();

  const headersPuzzles = [
    "Puzzle #", "Bits", "Range Início (Hex)", "Range Fim (Hex)",
    "Endereço Bitcoin", "Chave Pública (Secp256k1)", "Chave Privada (Hex/WIF)",
    "Prêmio (BTC)", "Status", "Viabilidade Computacional", "Última Atualização"
  ];

  sheetPuzzles.getRange(1, 1, 1, headersPuzzles.length)
    .setValues([headersPuzzles])
    .setBackground("#1a1a24").setFontColor("#f59e0b")
    .setFontWeight("bold").setHorizontalAlignment("center");

  const rawPuzzles = [
  [
    "#1",
    1,
    "'0x1",
    "'0x1",
    "1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH",
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "0000000000000000000000000000000000000000000000000000000000000001",
    0.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.888Z"
  ],
  [
    "#2",
    2,
    "'0x2",
    "'0x3",
    "1CUNEBjYrCn2y1SdiUMohaKUi4wpP326Lb",
    "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
    "0000000000000000000000000000000000000000000000000000000000000003",
    0.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#3",
    3,
    "'0x4",
    "'0x7",
    "19ZewH8Kk1PDbSNdJ97FP4EiCjTRaZMZQA",
    "025cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc",
    "0000000000000000000000000000000000000000000000000000000000000007",
    0.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#4",
    4,
    "'0x8",
    "'0xf",
    "1EhqbyUMvvs7BfL8goY6qcPbD6YKfPqb7e",
    "022f01e5e15cca351daff3843fb70f3c2f0a1bdd05e5af888a67784ef3e10a2a01",
    "0000000000000000000000000000000000000000000000000000000000000008",
    0.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#5",
    5,
    "'0x10",
    "'0x1f",
    "1E6NuFjCi27W5zoXg8TRdcSRq84zJeBW3k",
    "02352bbf4a4cdd12564f93fa332ce333301d9ad40271f8107181340aef25be59d5",
    "0000000000000000000000000000000000000000000000000000000000000015",
    0.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#6",
    6,
    "'0x20",
    "'0x3f",
    "1PitScNLyp2HCygzadCh7FveTnfmpPbfp8",
    "03f2dac991cc4ce4b9ea44887e5c7c0bce58c80074ab9d4dbaeb28531b7739f530",
    "0000000000000000000000000000000000000000000000000000000000000031",
    0.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#7",
    7,
    "'0x40",
    "'0x7f",
    "1McVt1vMtCC7yn5b9wgX1833yCcLXzueeC",
    "0296516a8f65774275278d0d7420a88df0ac44bd64c7bae07c3fe397c5b3300b23",
    "000000000000000000000000000000000000000000000000000000000000004c",
    0.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#8",
    8,
    "'0x80",
    "'0xff",
    "1M92tSqNmQLYw33fuBvjmeadirh1ysMBxK",
    "0308bc89c2f919ed158885c35600844d49890905c79b357322609c45706ce6b514",
    "00000000000000000000000000000000000000000000000000000000000000e0",
    0.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#9",
    9,
    "'0x100",
    "'0x1ff",
    "1CQFwcjw1dwhtkVWBttNLDtqL7ivBonGPV",
    "0243601d61c836387485e9514ab5c8924dd2cfd466af34ac95002727e1659d60f7",
    "00000000000000000000000000000000000000000000000000000000000001d3",
    0.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#10",
    10,
    "'0x200",
    "'0x3ff",
    "1LeBZP5QCwwgXRtmVUvTVrraqPUokyLHqe",
    "03a7a4c30291ac1db24b4ab00c442aa832f7794b5a0959bec6e8d7fee802289dcd",
    "0000000000000000000000000000000000000000000000000000000000000202",
    1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#11",
    11,
    "'0x400",
    "'0x7ff",
    "1PgQVLmst3Z314JrQn5TNiys8Hc38TcXJu",
    "038b05b0603abd75b0c57489e451f811e1afe54a8715045cdf4888333f3ebc6e8b",
    "0000000000000000000000000000000000000000000000000000000000000483",
    1.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#12",
    12,
    "'0x800",
    "'0xfff",
    "1DBaumZxUkM4qMQRt2LVWyFJq5kDtSZQot",
    "038b00fcbfc1a203f44bf123fc7f4c91c10a85c8eae9187f9d22242b4600ce781c",
    "0000000000000000000000000000000000000000000000000000000000000a7b",
    1.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#13",
    13,
    "'0x1000",
    "'0x1fff",
    "1Pie8JkxBT6MGPz9Nvi3fsPkr2D8q3GBc1",
    "03aadaaab1db8d5d450b511789c37e7cfeb0eb8b3e61a57a34166c5edc9a4b869d",
    "0000000000000000000000000000000000000000000000000000000000001460",
    1.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#14",
    14,
    "'0x2000",
    "'0x3fff",
    "1ErZWg5cFCe4Vw5BzgfzB74VNLaXEiEkhk",
    "03b4f1de58b8b41afe9fd4e5ffbdafaeab86c5db4769c15d6e6011ae7351e54759",
    "0000000000000000000000000000000000000000000000000000000000002930",
    1.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#15",
    15,
    "'0x4000",
    "'0x7fff",
    "1QCbW9HWnwQWiQqVo5exhAnmfqKRrCRsvW",
    "02fea58ffcf49566f6e9e9350cf5bca2861312f422966e8db16094beb14dc3df2c",
    "00000000000000000000000000000000000000000000000000000000000068f3",
    1.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#16",
    16,
    "'0x8000",
    "'0xffff",
    "1BDyrQ6WoF8VN3g9SAS1iKZcPzFfnDVieY",
    "029d8c5d35231d75eb87fd2c5f05f65281ed9573dc41853288c62ee94eb2590b7a",
    "000000000000000000000000000000000000000000000000000000000000c936",
    1.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#17",
    17,
    "'0x10000",
    "'0x1ffff",
    "1HduPEXZRdG26SUT5Yk83mLkPyjnZuJ7Bm",
    "033f688bae8321b8e02b7e6c0a55c2515fb25ab97d85fda842449f7bfa04e128c3",
    "000000000000000000000000000000000000000000000000000000000001764f",
    1.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#18",
    18,
    "'0x20000",
    "'0x3ffff",
    "1GnNTmTVLZiqQfLbAdp9DVdicEnB5GoERE",
    "020ce4a3291b19d2e1a7bf73ee87d30a6bdbc72b20771e7dfff40d0db755cd4af1",
    "000000000000000000000000000000000000000000000000000000000003080d",
    1.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#19",
    19,
    "'0x40000",
    "'0x7ffff",
    "1NWmZRpHH4XSPwsW6dsS3nrNWfL1yrJj4w",
    "0385663c8b2f90659e1ccab201694f4f8ec24b3749cfe5030c7c3646a709408e19",
    "000000000000000000000000000000000000000000000000000000000005749f",
    1.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#20",
    20,
    "'0x80000",
    "'0xfffff",
    "1HsMJxNiV7TLxmoF6uJNkydxPFDog4NQum",
    "033c4a45cbd643ff97d77f41ea37e843648d50fd894b864b0d52febc62f6454f7c",
    "00000000000000000000000000000000000000000000000000000000000d2c55",
    2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#21",
    21,
    "'0x100000",
    "'0x1fffff",
    "14oFNXucftsHiUMY8uctg6N487riuyXs4h",
    "031a746c78f72754e0be046186df8a20cdce5c79b2eda76013c647af08d306e49e",
    "00000000000000000000000000000000000000000000000000000000001ba534",
    2.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#22",
    22,
    "'0x200000",
    "'0x3fffff",
    "1CfZWK1QTQE3eS9qn61dQjV89KDjZzfNcv",
    "023ed96b524db5ff4fe007ce730366052b7c511dc566227d929070b9ce917abb43",
    "00000000000000000000000000000000000000000000000000000000002de40f",
    2.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#23",
    23,
    "'0x400000",
    "'0x7fffff",
    "1L2GM8eE7mJWLdo3HZS6su1832NX2txaac",
    "03f82710361b8b81bdedb16994f30c80db522450a93e8e87eeb07f7903cf28d04b",
    "0000000000000000000000000000000000000000000000000000000000556e52",
    2.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#24",
    24,
    "'0x800000",
    "'0xffffff",
    "1rSnXMr63jdCuegJFuidJqWxUPV7AtUf7",
    "036ea839d22847ee1dce3bfc5b11f6cf785b0682db58c35b63d1342eb221c3490c",
    "0000000000000000000000000000000000000000000000000000000000dc2a04",
    2.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#25",
    25,
    "'0x1000000",
    "'0x1ffffff",
    "15JhYXn6Mx3oF4Y7PcTAv2wVVAuCFFQNiP",
    "03057fbea3a2623382628dde556b2a0698e32428d3cd225f3bd034dca82dd7455a",
    "0000000000000000000000000000000000000000000000000000000001fa5ee5",
    2.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#26",
    26,
    "'0x2000000",
    "'0x3ffffff",
    "1JVnST957hGztonaWK6FougdtjxzHzRMMg",
    "024e4f50a2a3eccdb368988ae37cd4b611697b26b29696e42e06d71368b4f3840f",
    "000000000000000000000000000000000000000000000000000000000340326e",
    2.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#27",
    27,
    "'0x4000000",
    "'0x7ffffff",
    "128z5d7nN7PkCuX5qoA4Ys6pmxUYnEy86k",
    "031a864bae3922f351f1b57cfdd827c25b7e093cb9c88a72c1cd893d9f90f44ece",
    "0000000000000000000000000000000000000000000000000000000006ac3875",
    2.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#28",
    28,
    "'0x8000000",
    "'0xfffffff",
    "12jbtzBb54r97TCwW3G1gCFoumpckRAPdY",
    "03e9e661838a96a65331637e2a3e948dc0756e5009e7cb5c36664d9b72dd18c0a7",
    "000000000000000000000000000000000000000000000000000000000d916ce8",
    2.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#29",
    29,
    "'0x10000000",
    "'0x1fffffff",
    "19EEC52krRUK1RkUAEZmQdjTyHT7Gp1TYT",
    "026caad634382d34691e3bef43ed4a124d8909a8a3362f91f1d20abaaf7e917b36",
    "0000000000000000000000000000000000000000000000000000000017e2551e",
    2.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#30",
    30,
    "'0x20000000",
    "'0x3fffffff",
    "1LHtnpd8nU5VHEMkG2TMYYNUjjLc992bps",
    "030d282cf2ff536d2c42f105d0b8588821a915dc3f9a05bd98bb23af67a2e92a5b",
    "000000000000000000000000000000000000000000000000000000003d94cd64",
    3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#31",
    31,
    "'0x40000000",
    "'0x7fffffff",
    "1LhE6sCTuGae42Axu1L1ZB7L96yi9irEBE",
    "0387dc70db1806cd9a9a76637412ec11dd998be666584849b3185f7f9313c8fd28",
    "000000000000000000000000000000000000000000000000000000007d4fe747",
    3.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#32",
    32,
    "'0x80000000",
    "'0xffffffff",
    "1FRoHA9xewq7DjrZ1psWJVeTer8gHRqEvR",
    "0209c58240e50e3ba3f833c82655e8725c037a2294e14cf5d73a5df8d56159de69",
    "00000000000000000000000000000000000000000000000000000000b862a62e",
    3.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#33",
    33,
    "'0x100000000",
    "'0x1ffffffff",
    "187swFMjz1G54ycVU56B7jZFHFTNVQFDiu",
    "03a355aa5e2e09dd44bb46a4722e9336e9e3ee4ee4e7b7a0cf5785b283bf2ab579",
    "00000000000000000000000000000000000000000000000000000001a96ca8d8",
    3.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#34",
    34,
    "'0x200000000",
    "'0x3ffffffff",
    "1PWABE7oUahG2AFFQhhvViQovnCr4rEv7Q",
    "033cdd9d6d97cbfe7c26f902faf6a435780fe652e159ec953650ec7b1004082790",
    "000000000000000000000000000000000000000000000000000000034a65911d",
    3.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#35",
    35,
    "'0x400000000",
    "'0x7ffffffff",
    "1PWCx5fovoEaoBowAvF5k91m2Xat9bMgwb",
    "02f6a8148a62320e149cb15c544fe8a25ab483a0095d2280d03b8a00a7feada13d",
    "00000000000000000000000000000000000000000000000000000004aed21170",
    3.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#36",
    36,
    "'0x800000000",
    "'0xfffffffff",
    "1Be2UF9NLfyLFbtm3TCbmuocc9N1Kduci1",
    "02b3e772216695845fa9dda419fb5daca28154d8aa59ea302f05e916635e47b9f6",
    "00000000000000000000000000000000000000000000000000000009de820a7c",
    3.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#37",
    37,
    "'0x1000000000",
    "'0x1fffffffff",
    "14iXhn8bGajVWegZHJ18vJLHhntcpL4dex",
    "027d2c03c3ef0aec70f2c7e1e75454a5dfdd0e1adea670c1b3a4643c48ad0f1255",
    "0000000000000000000000000000000000000000000000000000001757756a93",
    3.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#38",
    38,
    "'0x2000000000",
    "'0x3fffffffff",
    "1HBtApAFA9B2YZw3G2YKSMCtb3dVnjuNe2",
    "03c060e1e3771cbeccb38e119c2414702f3f5181a89652538851d2e3886bdd70c6",
    "00000000000000000000000000000000000000000000000000000022382facd0",
    3.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#39",
    39,
    "'0x4000000000",
    "'0x7fffffffff",
    "122AJhKLEfkFBaGAd84pLp1kfE7xK3GdT8",
    "022d77cd1467019a6bf28f7375d0949ce30e6b5815c2758b98a74c2700bc006543",
    "0000000000000000000000000000000000000000000000000000004b5f8303e9",
    3.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#40",
    40,
    "'0x8000000000",
    "'0xffffffffff",
    "1EeAxcprB2PpCnr34VfZdFrkUWuxyiNEFv",
    "03a2efa402fd5268400c77c20e574ba86409ededee7c4020e4b9f0edbee53de0d4",
    "000000000000000000000000000000000000000000000000000000e9ae4933d6",
    4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#41",
    41,
    "'0x10000000000",
    "'0x1ffffffffff",
    "1L5sU9qvJeuwQUdt4y1eiLmquFxKjtHr3E",
    "03b357e68437da273dcf995a474a524439faad86fc9effc300183f714b0903468b",
    "00000000000000000000000000000000000000000000000000000153869acc5b",
    4.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#42",
    42,
    "'0x20000000000",
    "'0x3ffffffffff",
    "1E32GPWgDyeyQac4aJxm9HVoLrrEYPnM4N",
    "03eec88385be9da803a0d6579798d977a5d0c7f80917dab49cb73c9e3927142cb6",
    "000000000000000000000000000000000000000000000000000002a221c58d8f",
    4.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#43",
    43,
    "'0x40000000000",
    "'0x7ffffffffff",
    "1PiFuqGpG8yGM5v6rNHWS3TjsG6awgEGA1",
    "02a631f9ba0f28511614904df80d7f97a4f43f02249c8909dac92276ccf0bcdaed",
    "000000000000000000000000000000000000000000000000000006bd3b27c591",
    4.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#44",
    44,
    "'0x80000000000",
    "'0xfffffffffff",
    "1CkR2uS7LmFwc3T2jV8C1BhWb5mQaoxedF",
    "025e466e97ed0e7910d3d90ceb0332df48ddf67d456b9e7303b50a3d89de357336",
    "00000000000000000000000000000000000000000000000000000e02b35a358f",
    4.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#45",
    45,
    "'0x100000000000",
    "'0x1fffffffffff",
    "1NtiLNGegHWE3Mp9g2JPkgx6wUg4TW7bbk",
    "026ecabd2d22fdb737be21975ce9a694e108eb94f3649c586cc7461c8abf5da71a",
    "0000000000000000000000000000000000000000000000000000122fca143c05",
    4.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#46",
    46,
    "'0x200000000000",
    "'0x3fffffffffff",
    "1F3JRMWudBaj48EhwcHDdpeuy2jwACNxjP",
    "03fd5487722d2576cb6d7081426b66a3e2986c1ce8358d479063fb5f2bb6dd5849",
    "00000000000000000000000000000000000000000000000000002ec18388d544",
    4.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#47",
    47,
    "'0x400000000000",
    "'0x7fffffffffff",
    "1Pd8VvT49sHKsmqrQiP61RsVwmXCZ6ay7Z",
    "023a12bd3caf0b0f77bf4eea8e7a40dbe27932bf80b19ac72f5f5a64925a594196",
    "00000000000000000000000000000000000000000000000000006cd610b53cba",
    4.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#48",
    48,
    "'0x800000000000",
    "'0xffffffffffff",
    "1DFYhaB2J9q1LLZJWKTnscPWos9VBqDHzv",
    "0291bee5cf4b14c291c650732faa166040e4c18a14731f9a930c1e87d3ec12debb",
    "0000000000000000000000000000000000000000000000000000ade6d7ce3b9b",
    4.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#49",
    49,
    "'0x1000000000000",
    "'0x1ffffffffffff",
    "12CiUhYVTTH33w3SPUBqcpMoqnApAV4WCF",
    "02591d682c3da4a2a698633bf5751738b67c343285ebdc3492645cb44658911484",
    "000000000000000000000000000000000000000000000000000174176b015f4d",
    4.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#50",
    50,
    "'0x2000000000000",
    "'0x3ffffffffffff",
    "1MEzite4ReNuWaL5Ds17ePKt2dCxWEofwk",
    "03f46f41027bbf44fafd6b059091b900dad41e6845b2241dc3254c7cdd3c5a16c6",
    "00000000000000000000000000000000000000000000000000022bd43c2e9354",
    5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#51",
    51,
    "'0x4000000000000",
    "'0x7ffffffffffff",
    "1NpnQyZ7x24ud82b7WiRNvPm6N8bqGQnaS",
    "028c6c67bef9e9eebe6a513272e50c230f0f91ed560c37bc9b033241ff6c3be78f",
    "00000000000000000000000000000000000000000000000000075070a1a009d4",
    5.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#52",
    52,
    "'0x8000000000000",
    "'0xfffffffffffff",
    "15z9c9sVpu6fwNiK7dMAFgMYSK4GqsGZim",
    "0374c33bd548ef02667d61341892134fcf216640bc2201ae61928cd0874f6314a7",
    "000000000000000000000000000000000000000000000000000efae164cb9e3c",
    5.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#53",
    53,
    "'0x10000000000000",
    "'0x1fffffffffffff",
    "15K1YKJMiJ4fpesTVUcByoz334rHmknxmT",
    "020faaf5f3afe58300a335874c80681cf66933e2a7aeb28387c0d28bb048bc6349",
    "00000000000000000000000000000000000000000000000000180788e47e326c",
    5.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#54",
    54,
    "'0x20000000000000",
    "'0x3fffffffffffff",
    "1KYUv7nSvXx4642TKeuC2SNdTk326uUpFy",
    "034af4b81f8c450c2c870ce1df184aff1297e5fcd54944d98d81e1a545ffb22596",
    "00000000000000000000000000000000000000000000000000236fb6d5ad1f43",
    5.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#55",
    55,
    "'0x40000000000000",
    "'0x7fffffffffffff",
    "1LzhS3k3e9Ub8i2W1V8xQFdB8n2MYCHPCa",
    "0385a30d8413af4f8f9e6312400f2d194fe14f02e719b24c3f83bf1fd233a8f963",
    "000000000000000000000000000000000000000000000000006abe1f9b67e114",
    5.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#56",
    56,
    "'0x80000000000000",
    "'0xffffffffffffff",
    "17aPYR1m6pVAacXg1PTDDU7XafvK1dxvhi",
    "033f2db2074e3217b3e5ee305301eeebb1160c4fa1e993ee280112f6348637999a",
    "000000000000000000000000000000000000000000000000009d18b63ac4ffdf",
    5.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#57",
    57,
    "'0x100000000000000",
    "'0x1ffffffffffffff",
    "15c9mPGLku1HuW9LRtBf4jcHVpBUt8txKz",
    "02a521a07e98f78b03fc1e039bc3a51408cd73119b5eb116e583fe57dc8db07aea",
    "00000000000000000000000000000000000000000000000001eb25c90795d61c",
    5.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#58",
    58,
    "'0x200000000000000",
    "'0x3ffffffffffffff",
    "1Dn8NF8qDyyfHMktmuoQLGyjWmZXgvosXf",
    "0311569442e870326ceec0de24eb5478c19e146ecd9d15e4666440f2f638875f42",
    "00000000000000000000000000000000000000000000000002c675b852189a21",
    5.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#59",
    59,
    "'0x400000000000000",
    "'0x7ffffffffffffff",
    "1HAX2n9Uruu9YDt4cqRgYcvtGvZj1rbUyt",
    "0241267d2d7ee1a8e76f8d1546d0d30aefb2892d231cee0dde7776daf9f8021485",
    "00000000000000000000000000000000000000000000000007496cbb87cab44f",
    5.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#60",
    60,
    "'0x800000000000000",
    "'0xfffffffffffffff",
    "1Kn5h2qpgw9mWE5jKpk8PP4qvvJ1QVy8su",
    "0348e843dc5b1bd246e6309b4924b81543d02b16c8083df973a89ce2c7eb89a10d",
    "0000000000000000000000000000000000000000000000000fc07a1825367bbe",
    6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#61",
    61,
    "'0x1000000000000000",
    "'0x1fffffffffffffff",
    "1AVJKwzs9AskraJLGHAZPiaZcrpDr1U6AB",
    "0249a43860d115143c35c09454863d6f82a95e47c1162fb9b2ebe0186eb26f453f",
    "00000000000000000000000000000000000000000000000013c96a3742f64906",
    6.1,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#62",
    62,
    "'0x2000000000000000",
    "'0x3fffffffffffffff",
    "1Me6EfpwZK5kQziBwBfvLiHjaPGxCKLoJi",
    "03231a67e424caf7d01a00d5cd49b0464942255b8e48766f96602bdfa4ea14fea8",
    "000000000000000000000000000000000000000000000000363d541eb611abee",
    6.2,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#63",
    63,
    "'0x4000000000000000",
    "'0x7fffffffffffffff",
    "1NpYjtLira16LfGbGwZJ5JbDPh3ai9bjf4",
    "0365ec2994b8cc0a20d40dd69edfe55ca32a54bcbbaa6b0ddcff36049301a54579",
    "0000000000000000000000000000000000000000000000007cce5efdaccf6808",
    6.3,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#64",
    64,
    "'0x8000000000000000",
    "'0xffffffffffffffff",
    "16jY7qLJnxb7CHZyqBP8qca9d51gAjyXQN",
    "03100611c54dfef604163b8358f7b7fac13ce478e02cb224ae16d45526b25d9d4d",
    "000000000000000000000000000000000000000000000000f7051f27b09112d4",
    6.4,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#65",
    65,
    "'0x10000000000000000",
    "'0x1ffffffffffffffff",
    "18ZMbwUFLMHoZBbfpCjUJQTCMCbktshgpe",
    "0230210c23b1a047bc9bdbb13448e67deddc108946de6de639bcc75d47c0216b1b",
    "000000000000000000000000000000000000000000000001a838b13505b26867",
    6.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#66",
    66,
    "'0x20000000000000000",
    "'0x3ffffffffffffffff",
    "13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so",
    "024ee2be2d4e9f92d2f5a4a03058617dc45befe22938feed5b7a6b7282dd74cbdd",
    "000000000000000000000000000000000000000000000002832ed74f2b5e35ee",
    6.6,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#67",
    67,
    "'0x40000000000000000",
    "'0x7ffffffffffffffff",
    "1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9",
    "0212209f5ec514a1580a2937bd833979d933199fc230e204c6cdc58872b7d46f75",
    "00000000000000000000000000000000000000000000000730fc235c1942c1ae",
    6.7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#68",
    68,
    "'0x80000000000000000",
    "'0xfffffffffffffffff",
    "1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ",
    "031fe02f1d740637a7127cdfe8a77a8a0cfc6435f85e7ec3282cb6243c0a93ba1b",
    "00000000000000000000000000000000000000000000000bebb3940cd0fc1491",
    6.8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#69",
    69,
    "'0x100000000000000000",
    "'0x1fffffffffffffffff",
    "19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG",
    "024babadccc6cfd5f0e5e7fd2a50aa7d677ce0aa16fdce26a0d0882eed03e7ba53",
    "0000000000000000000000000000000000000000000000101d83275fb2bc7e0c",
    6.9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#70",
    70,
    "'0x200000000000000000",
    "'0x3fffffffffffffffff",
    "19YZECXj3SxEZMoUeJ1yiPsw8xANe7M7QR",
    "0290e6900a58d33393bc1097b5aed31f2e4e7cbd3e5466af958665bc0121248483",
    "0000000000000000000000000000000000000000000000349b84b6431a6c4ef1",
    7,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#71",
    71,
    "'0x400000000000000000",
    "'0x7fffffffffffffffff",
    "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU",
    "Oculta",
    "",
    7.1,
    "UNSOLVED",
    "🎯 ALVO IMEDIATO (Kangaroo GPU)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#72",
    72,
    "'0x800000000000000000",
    "'0xffffffffffffffffff",
    "1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR",
    "Oculta",
    "",
    7.2,
    "UNSOLVED",
    "🎯 ALVO IMEDIATO (Kangaroo GPU)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#73",
    73,
    "'0x1000000000000000000",
    "'0x1ffffffffffffffffff",
    "12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4",
    "Oculta",
    "",
    7.3,
    "UNSOLVED",
    "🎯 ALVO IMEDIATO (Kangaroo GPU)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#74",
    74,
    "'0x2000000000000000000",
    "'0x3ffffffffffffffffff",
    "1FWGcVDK3JGzCC3WtkYetULPszMaK2Jksv",
    "Oculta",
    "",
    7.4,
    "UNSOLVED",
    "🎯 ALVO IMEDIATO (Kangaroo GPU)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#75",
    75,
    "'0x4000000000000000000",
    "'0x7ffffffffffffffffff",
    "1J36UjUByGroXcCvmj13U6uwaVv9caEeAt",
    "03726b574f193e374686d8e12bc6e4142adeb06770e0a2856f5e4ad89f66044755",
    "0000000000000000000000000000000000000000000004c5ce114686a1336e07",
    7.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#76",
    76,
    "'0x8000000000000000000",
    "'0xfffffffffffffffffff",
    "1DJh2eHFYQfACPmrvpyWc8MSTYKh7w9eRF",
    "Oculta",
    "",
    7.6,
    "UNSOLVED",
    "🟡 Viável em Pool Colaborativo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#77",
    77,
    "'0x10000000000000000000",
    "'0x1fffffffffffffffffff",
    "1Bxk4CQdqL9p22JEtDfdXMsng1XacifUtE",
    "Oculta",
    "",
    7.7,
    "UNSOLVED",
    "🟡 Viável em Pool Colaborativo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#78",
    78,
    "'0x20000000000000000000",
    "'0x3fffffffffffffffffff",
    "15qF6X51huDjqTmF9BJgxXdt1xcj46Jmhb",
    "Oculta",
    "",
    7.8,
    "UNSOLVED",
    "🟡 Viável em Pool Colaborativo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#79",
    79,
    "'0x40000000000000000000",
    "'0x7fffffffffffffffffff",
    "1ARk8HWJMn8js8tQmGUJeQHjSE7KRkn2t8",
    "Oculta",
    "",
    7.9,
    "UNSOLVED",
    "🟡 Viável em Pool Colaborativo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#80",
    80,
    "'0x80000000000000000000",
    "'0xffffffffffffffffffff",
    "1BCf6rHUW6m3iH2ptsvnjgLruAiPQQepLe",
    "037e1238f7b1ce757df94faa9a2eb261bf0aeb9f84dbf81212104e78931c2a19dc",
    "00000000000000000000000000000000000000000000ea1a5c66dcc11b5ad180",
    8,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#81",
    81,
    "'0x100000000000000000000",
    "'0x1ffffffffffffffffffff",
    "15qsCm78whspNQFydGJQk5rexzxTQopnHZ",
    "Oculta",
    "",
    8.1,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#82",
    82,
    "'0x200000000000000000000",
    "'0x3ffffffffffffffffffff",
    "13zYrYhhJxp6Ui1VV7pqa5WDhNWM45ARAC",
    "Oculta",
    "",
    8.2,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#83",
    83,
    "'0x400000000000000000000",
    "'0x7ffffffffffffffffffff",
    "14MdEb4eFcT3MVG5sPFG4jGLuHJSnt1Dk2",
    "Oculta",
    "",
    8.3,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#84",
    84,
    "'0x800000000000000000000",
    "'0xfffffffffffffffffffff",
    "1CMq3SvFcVEcpLMuuH8PUcNiqsK1oicG2D",
    "Oculta",
    "",
    8.4,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#85",
    85,
    "'0x1000000000000000000000",
    "'0x1fffffffffffffffffffff",
    "1Kh22PvXERd2xpTQk3ur6pPEqFeckCJfAr",
    "0329c4574a4fd8c810b7e42a4b398882b381bcd85e40c6883712912d167c83e73a",
    "00000000000000000000000000000000000000000011720c4f018d51b8cebba8",
    8.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#86",
    86,
    "'0x2000000000000000000000",
    "'0x3fffffffffffffffffffff",
    "1K3x5L6G57Y494fDqBfrojD28UJv4s5JcK",
    "Oculta",
    "",
    8.6,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#87",
    87,
    "'0x4000000000000000000000",
    "'0x7fffffffffffffffffffff",
    "1PxH3K1Shdjb7gSEoTX7UPDZ6SH4qGPrvq",
    "Oculta",
    "",
    8.7,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#88",
    88,
    "'0x8000000000000000000000",
    "'0xffffffffffffffffffffff",
    "16AbnZjZZipwHMkYKBSfswGWKDmXHjEpSf",
    "Oculta",
    "",
    8.8,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#89",
    89,
    "'0x10000000000000000000000",
    "'0x1ffffffffffffffffffffff",
    "19QciEHbGVNY4hrhfKXmcBBCrJSBZ6TaVt",
    "Oculta",
    "",
    8.9,
    "UNSOLVED",
    "🔴 Desafio de Longo Prazo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#90",
    90,
    "'0x20000000000000000000000",
    "'0x3ffffffffffffffffffffff",
    "1L12FHH2FHjvTviyanuiFVfmzCy46RRATU",
    "035c38bd9ae4b10e8a250857006f3cfd98ab15a6196d9f4dfd25bc7ecc77d788d5",
    "000000000000000000000000000000000000000002ce00bb2136a445c71e85bf",
    9,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#91",
    91,
    "'0x40000000000000000000000",
    "'0x7ffffffffffffffffffffff",
    "1EzVHtmbN4fs4MiNk3ppEnKKhsmXYJ4s74",
    "Oculta",
    "",
    9.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#92",
    92,
    "'0x80000000000000000000000",
    "'0xfffffffffffffffffffffff",
    "1AE8NzzgKE7Yhz7BWtAcAAxiFMbPo82NB5",
    "Oculta",
    "",
    9.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#93",
    93,
    "'0x100000000000000000000000",
    "'0x1fffffffffffffffffffffff",
    "17Q7tuG2JwFFU9rXVj3uZqRtioH3mx2Jad",
    "Oculta",
    "",
    9.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#94",
    94,
    "'0x200000000000000000000000",
    "'0x3fffffffffffffffffffffff",
    "1K6xGMUbs6ZTXBnhw1pippqwK6wjBWtNpL",
    "Oculta",
    "",
    9.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#95",
    95,
    "'0x400000000000000000000000",
    "'0x7fffffffffffffffffffffff",
    "19eVSDuizydXxhohGh8Ki9WY9KsHdSwoQC",
    "02967a5905d6f3b420959a02789f96ab4c3223a2c4d2762f817b7895c5bc88a045",
    "0000000000000000000000000000000000000000527a792b183c7f64a0e8b1f4",
    9.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#96",
    96,
    "'0x800000000000000000000000",
    "'0xffffffffffffffffffffffff",
    "15ANYzzCp5BFHcCnVFzXqyibpzgPLWaD8b",
    "Oculta",
    "",
    9.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#97",
    97,
    "'0x1000000000000000000000000",
    "'0x1ffffffffffffffffffffffff",
    "18ywPwj39nGjqBrQJSzZVq2izR12MDpDr8",
    "Oculta",
    "",
    9.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#98",
    98,
    "'0x2000000000000000000000000",
    "'0x3ffffffffffffffffffffffff",
    "1CaBVPrwUxbQYYswu32w7Mj4HR4maNoJSX",
    "Oculta",
    "",
    9.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#99",
    99,
    "'0x4000000000000000000000000",
    "'0x7ffffffffffffffffffffffff",
    "1JWnE6p6UN7ZJBN7TtcbNDoRcjFtuDWoNL",
    "Oculta",
    "",
    9.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#100",
    100,
    "'0x8000000000000000000000000",
    "'0xfffffffffffffffffffffffff",
    "1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F",
    "03d2063d40402f030d4cc71331468827aa41a8a09bd6fd801ba77fb64f8e67e617",
    "000000000000000000000000000000000000000af55fc59c335c8ec67ed24826",
    10,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#101",
    101,
    "'0x10000000000000000000000000",
    "'0x1fffffffffffffffffffffffff",
    "1CKCVdbDJasYmhswB6HKZHEAnNaDpK7W4n",
    "Oculta",
    "",
    10.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#102",
    102,
    "'0x20000000000000000000000000",
    "'0x3fffffffffffffffffffffffff",
    "1PXv28YxmYMaB8zxrKeZBW8dt2HK7RkRPX",
    "Oculta",
    "",
    10.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#103",
    103,
    "'0x40000000000000000000000000",
    "'0x7fffffffffffffffffffffffff",
    "1AcAmB6jmtU6AiEcXkmiNE9TNVPsj9DULf",
    "Oculta",
    "",
    10.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#104",
    104,
    "'0x80000000000000000000000000",
    "'0xffffffffffffffffffffffffff",
    "1EQJvpsmhazYCcKX5Au6AZmZKRnzarMVZu",
    "Oculta",
    "",
    10.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#105",
    105,
    "'0x100000000000000000000000000",
    "'0x1ffffffffffffffffffffffffff",
    "1CMjscKB3QW7SDyQ4c3C3DEUHiHRhiZVib",
    "03bcf7ce887ffca5e62c9cabbdb7ffa71dc183c52c04ff4ee5ee82e0c55c39d77b",
    "000000000000000000000000000000000000016f14fc2054cd87ee6396b33df3",
    10.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#106",
    106,
    "'0x200000000000000000000000000",
    "'0x3ffffffffffffffffffffffffff",
    "18KsfuHuzQaBTNLASyj15hy4LuqPUo1FNB",
    "Oculta",
    "",
    10.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#107",
    107,
    "'0x400000000000000000000000000",
    "'0x7ffffffffffffffffffffffffff",
    "15EJFC5ZTs9nhsdvSUeBXjLAuYq3SWaxTc",
    "Oculta",
    "",
    10.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#108",
    108,
    "'0x800000000000000000000000000",
    "'0xfffffffffffffffffffffffffff",
    "1HB1iKUqeffnVsvQsbpC6dNi1XKbyNuqao",
    "Oculta",
    "",
    10.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#109",
    109,
    "'0x1000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffff",
    "1GvgAXVCbA8FBjXfWiAms4ytFeJcKsoyhL",
    "Oculta",
    "",
    10.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#110",
    110,
    "'0x2000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffff",
    "12JzYkkN76xkwvcPT6AWKZtGX6w2LAgsJg",
    "0309976ba5570966bf889196b7fdf5a0f9a1e9ab340556ec29f8bb60599616167d",
    "00000000000000000000000000000000000035c0d7234df7deb0f20cf7062444",
    11,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#111",
    111,
    "'0x4000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffff",
    "1824ZJQ7nKJ9QFTRBqn7z7dHV5EGpzUpH3",
    "Oculta",
    "",
    11.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#112",
    112,
    "'0x8000000000000000000000000000",
    "'0xffffffffffffffffffffffffffff",
    "18A7NA9FTsnJxWgkoFfPAFbQzuQxpRtCos",
    "Oculta",
    "",
    11.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#113",
    113,
    "'0x10000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffff",
    "1NeGn21dUDDeqFQ63xb2SpgUuXuBLA4WT4",
    "Oculta",
    "",
    11.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#114",
    114,
    "'0x20000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffff",
    "174SNxfqpdMGYy5YQcfLbSTK3MRNZEePoy",
    "Oculta",
    "",
    11.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#115",
    115,
    "'0x40000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffff",
    "1NLbHuJebVwUZ1XqDjsAyfTRUPwDQbemfv",
    "0248d313b0398d4923cdca73b8cfa6532b91b96703902fc8b32fd438a3b7cd7f55",
    "0000000000000000000000000000000000060f4d11574f5deee49961d9609ac6",
    11.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#116",
    116,
    "'0x80000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffff",
    "1MnJ6hdhvK37VLmqcdEwqC3iFxyWH2PHUV",
    "Oculta",
    "",
    11.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#117",
    117,
    "'0x100000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffff",
    "1KNRfGWw7Q9Rmwsc6NT5zsdvEb9M2Wkj5Z",
    "Oculta",
    "",
    11.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#118",
    118,
    "'0x200000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffff",
    "1PJZPzvGX19a7twf5HyD2VvNiPdHLzm9F6",
    "Oculta",
    "",
    11.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#119",
    119,
    "'0x400000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffff",
    "1GuBBhf61rnvRe4K8zu8vdQB3kHzwFqSy7",
    "Oculta",
    "",
    11.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#120",
    120,
    "'0x800000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffff",
    "17s2b9ksz5y7abUm92cHwG8jEPCzK3dLnT",
    "02ceb6cbbcdbdf5ef7150682150f4ce2c6f4807b349827dcdbdd1f2efa885a2630",
    "0000000000000000000000000000000000b10f22572c497a836ea187f2e1fc23",
    12,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#121",
    121,
    "'0x1000000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffffff",
    "1GDSuiThEV64c166LUFC9uDcVdGjqkxKyh",
    "Oculta",
    "",
    12.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#122",
    122,
    "'0x2000000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffffff",
    "1Me3ASYt5JCTAK2XaC32RMeH34PdprrfDx",
    "Oculta",
    "",
    12.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#123",
    123,
    "'0x4000000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffffff",
    "1CdufMQL892A69KXgv6UNBD17ywWqYpKut",
    "Oculta",
    "",
    12.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#124",
    124,
    "'0x8000000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffffff",
    "1BkkGsX9ZM6iwL3zbqs7HWBV7SvosR6m8N",
    "Oculta",
    "",
    12.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#125",
    125,
    "'0x10000000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffffff",
    "1PXAyUB8ZoH3WD8n5zoAthYjN15yN5CVq5",
    "0233709eb11e0d4439a729f21c2c443dedb727528229713f0065721ba8fa46f00e",
    "000000000000000000000000000000001c533b6bb7f0804e09960225e44877ac",
    12.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#126",
    126,
    "'0x20000000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffffff",
    "1AWCLZAjKbV1P7AHvaPNCKiB7ZWVDMxFiz",
    "Oculta",
    "",
    12.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#127",
    127,
    "'0x40000000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffffff",
    "1G6EFyBRU86sThN3SSt3GrHu1sA7w7nzi4",
    "Oculta",
    "",
    12.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#128",
    128,
    "'0x80000000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffffff",
    "1MZ2L1gFrCtkkn6DnTT2e4PFUTHw9gNwaj",
    "Oculta",
    "",
    12.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#129",
    129,
    "'0x100000000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffffffff",
    "1Hz3uv3nNZzBVMXLGadCucgjiCs5W9vaGz",
    "Oculta",
    "",
    12.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#130",
    130,
    "'0x200000000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffffffff",
    "1Fo65aKq8s8iquMt6weF1rku1moWVEd5Ua",
    "03633cbe3ec02b9401c5effa144c5b4d22f87940259634858fc7e59b1c09937852",
    "000000000000000000000000000000033e7665705359f04f28b88cf897c603c9",
    13,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#131",
    131,
    "'0x400000000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffffffff",
    "16zRPnT8znwq42q7XeMkZUhb1bKqgRogyy",
    "Oculta",
    "",
    13.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#132",
    132,
    "'0x800000000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffffffff",
    "1KrU4dHE5WrW8rhWDsTRjR21r8t3dsrS3R",
    "Oculta",
    "",
    13.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#133",
    133,
    "'0x1000000000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffffffff",
    "17uDfp5r4n441xkgLFmhNoSW1KWp6xVLD",
    "Oculta",
    "",
    13.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#134",
    134,
    "'0x2000000000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffffffff",
    "13A3JrvXmvg5w9XGvyyR4JEJqiLz8ZySY3",
    "Oculta",
    "",
    13.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#135",
    135,
    "'0x4000000000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffffffff",
    "16RGFo6hjq9ym6Pj7N5H7L1NR1rVPJyw2v",
    "02145d2611c823a396ef6712ce0f712f09b9b4f3135e3e0aa3230fb9b6d08d1e16",
    "",
    13.5,
    "SOLVED",
    "✅ Resolvido",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#136",
    136,
    "'0x8000000000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffffffff",
    "1UDHPdovvR985NrWSkdWQDEQ1xuRiTALq",
    "Oculta",
    "",
    13.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#137",
    137,
    "'0x10000000000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffffffffff",
    "15nf31J46iLuK1ZkTnqHo7WgN5cARFK3RA",
    "Oculta",
    "",
    13.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#138",
    138,
    "'0x20000000000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffffffffff",
    "1Ab4vzG6wEQBDNQM1B2bvUz4fqXXdFk2WT",
    "Oculta",
    "",
    13.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#139",
    139,
    "'0x40000000000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffffffffff",
    "1Fz63c775VV9fNyj25d9Xfw3YHE6sKCxbt",
    "Oculta",
    "",
    13.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#140",
    140,
    "'0x80000000000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffffffffff",
    "1QKBaU6WAeycb3DbKbLBkX7vJiaS8r42Xo",
    "031f6a332d3c5c4f2de2378c012f429cd109ba07d69690c6c701b6bb87860d6640",
    "",
    14,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#141",
    141,
    "'0x100000000000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffffffffff",
    "1CD91Vm97mLQvXhrnoMChhJx4TP9MaQkJo",
    "Oculta",
    "",
    14.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#142",
    142,
    "'0x200000000000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffffffffff",
    "15MnK2jXPqTMURX4xC3h4mAZxyCcaWWEDD",
    "Oculta",
    "",
    14.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#143",
    143,
    "'0x400000000000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffffffffff",
    "13N66gCzWWHEZBxhVxG18P8wyjEWF9Yoi1",
    "Oculta",
    "",
    14.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#144",
    144,
    "'0x800000000000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffffffffff",
    "1NevxKDYuDcCh1ZMMi6ftmWwGrZKC6j7Ux",
    "Oculta",
    "",
    14.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#145",
    145,
    "'0x1000000000000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffffffffffff",
    "19GpszRNUej5yYqxXoLnbZWKew3KdVLkXg",
    "03afdda497369e219a2c1c369954a930e4d3740968e5e4352475bcffce3140dae5",
    "",
    14.5,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#146",
    146,
    "'0x2000000000000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffffffffffff",
    "1M7ipcdYHey2Y5RZM34MBbpugghmjaV89P",
    "Oculta",
    "",
    14.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#147",
    147,
    "'0x4000000000000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffffffffffff",
    "18aNhurEAJsw6BAgtANpexk5ob1aGTwSeL",
    "Oculta",
    "",
    14.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#148",
    148,
    "'0x8000000000000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffffffffffff",
    "1FwZXt6EpRT7Fkndzv6K4b4DFoT4trbMrV",
    "Oculta",
    "",
    14.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#149",
    149,
    "'0x10000000000000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffffffffffff",
    "1CXvTzR6qv8wJ7eprzUKeWxyGcHwDYP1i2",
    "Oculta",
    "",
    14.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#150",
    150,
    "'0x20000000000000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffffffffffff",
    "1MUJSJYtGPVGkBCTqGspnxyHahpt5Te8jy",
    "03137807790ea7dc6e97901c2bc87411f45ed74a5629315c4e4b03a0a102250c49",
    "",
    15,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#151",
    151,
    "'0x40000000000000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffffffffffff",
    "13Q84TNNvgcL3HJiqQPvyBb9m4hxjS3jkV",
    "Oculta",
    "",
    15.1,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#152",
    152,
    "'0x80000000000000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffffffffffff",
    "1LuUHyrQr8PKSvbcY1v1PiuGuqFjWpDumN",
    "Oculta",
    "",
    15.2,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#153",
    153,
    "'0x100000000000000000000000000000000000000",
    "'0x1ffffffffffffffffffffffffffffffffffffff",
    "18192XpzzdDi2K11QVHR7td2HcPS6Qs5vg",
    "Oculta",
    "",
    15.3,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#154",
    154,
    "'0x200000000000000000000000000000000000000",
    "'0x3ffffffffffffffffffffffffffffffffffffff",
    "1NgVmsCCJaKLzGyKLFJfVequnFW9ZvnMLN",
    "Oculta",
    "",
    15.4,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#155",
    155,
    "'0x400000000000000000000000000000000000000",
    "'0x7ffffffffffffffffffffffffffffffffffffff",
    "1AoeP37TmHdFh8uN72fu9AqgtLrUwcv2wJ",
    "035cd1854cae45391ca4ec428cc7e6c7d9984424b954209a8eea197b9e364c05f6",
    "",
    15.5,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#156",
    156,
    "'0x800000000000000000000000000000000000000",
    "'0xfffffffffffffffffffffffffffffffffffffff",
    "1FTpAbQa4h8trvhQXjXnmNhqdiGBd1oraE",
    "Oculta",
    "",
    15.6,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#157",
    157,
    "'0x1000000000000000000000000000000000000000",
    "'0x1fffffffffffffffffffffffffffffffffffffff",
    "14JHoRAdmJg3XR4RjMDh6Wed6ft6hzbQe9",
    "Oculta",
    "",
    15.7,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#158",
    158,
    "'0x2000000000000000000000000000000000000000",
    "'0x3fffffffffffffffffffffffffffffffffffffff",
    "19z6waranEf8CcP8FqNgdwUe1QRxvUNKBG",
    "Oculta",
    "",
    15.8,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#159",
    159,
    "'0x4000000000000000000000000000000000000000",
    "'0x7fffffffffffffffffffffffffffffffffffffff",
    "14u4nA5sugaswb6SZgn5av2vuChdMnD9E5",
    "Oculta",
    "",
    15.9,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "#160",
    160,
    "'0x8000000000000000000000000000000000000000",
    "'0xffffffffffffffffffffffffffffffffffffffff",
    "1NBC8uXJy1GiJ6drkiZa1WuKn51ps7EPTv",
    "02e0a8b039282faf6fe0fd769cfbc4b6b4cf8758ba68220eac420e32b91ddfa673",
    "",
    16,
    "UNSOLVED",
    "⚫ Desafio Extremo",
    "2026-09-17T01:57:15.890Z"
  ]
];

  sheetPuzzles.getRange(2, 1, rawPuzzles.length, headersPuzzles.length).setValues(rawPuzzles);
  sheetPuzzles.setFrozenRows(1);
  sheetPuzzles.getRange(2, 3, rawPuzzles.length, 2).setNumberFormat("@");
  sheetPuzzles.getRange(2, 9, rawPuzzles.length, 2).setHorizontalAlignment("center");
  sheetPuzzles.setColumnWidth(1, 80);
  sheetPuzzles.setColumnWidth(2, 50);
  sheetPuzzles.setColumnWidth(3, 200);
  sheetPuzzles.setColumnWidth(4, 200);
  sheetPuzzles.setColumnWidth(5, 290);
  sheetPuzzles.setColumnWidth(6, 290);
  sheetPuzzles.setColumnWidth(7, 240);
  sheetPuzzles.getRange(2, 3, rawPuzzles.length, 5).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  // ─── ABA 2: OUTROS DESAFIOS CRIPTO (ETH, SOLANA, BIP39) ───
  let sheetOthers = ss.getSheetByName("Outros_Desafios_Cripto");
  if (!sheetOthers) sheetOthers = ss.insertSheet("Outros_Desafios_Cripto");
  sheetOthers.clear();

  const headersOthers = [
    "ID do Desafio", "Nome do Desafio", "Rede / Blockchain", "Dificuldade / Bits",
    "Intervalo de Busca", "Endereço Alvo / Contrato", "Prêmio Estimado",
    "Status", "Viabilidade Técnica", "Última Atualização"
  ];

  sheetOthers.getRange(1, 1, 1, headersOthers.length)
    .setValues([headersOthers])
    .setBackground("#1e1b4b").setFontColor("#a78bfa")
    .setFontWeight("bold").setHorizontalAlignment("center");

  const otherData = [
  [
    "ETH_VANITY_32",
    "Ethereum Vanity Challenge (Prefix 0x00000000)",
    "Ethereum (ETH)",
    "32 bits",
    "0x00000001 ➔ 0xffffffff",
    "0x0000000000000000000000000000000000000000",
    "0.50 ETH",
    "OPEN (Disponível)",
    "🟢 Imediato (GPU - Minutos)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "ETH_SMART_BOUNTY_48",
    "Ethereum Smart Contract Challenge #48",
    "Ethereum (ETH)",
    "48 bits",
    "0x100000000000 ➔ 0xffffffffffff",
    "0x71C8418013f890510850b4dC91C5B56064f7b2C1",
    "2.00 ETH",
    "OPEN (Disponível)",
    "🟡 Médio (GPU Cluster - Dias)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "ETH_BIP39_SEED_RECOVERY",
    "Ethereum 12-Word Seed (8 Palavras Conhecidas)",
    "Ethereum (ETH)",
    "44 bits efetivos",
    "abandon ability able about above absent absorb abstract [4 restantes] ➔ 2^44 combinações",
    "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
    "5.00 ETH",
    "OPEN (Disponível)",
    "🟢 Altamente Viável (BIP39 Filter)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "SOL_VANITY_PREFIX_36",
    "Solana Vanity Address (Prefix SOL999...)",
    "Solana (SOL)",
    "36 bits (Ed25519)",
    "0x100000000 ➔ 0xfffffffff",
    "SOL999xxxx111111111111111111111111111111111",
    "15.00 SOL",
    "OPEN (Disponível)",
    "🟢 Imediato (CPU/GPU - Horas)",
    "2026-09-17T01:57:15.890Z"
  ],
  [
    "BTC_SATOSHI_NONCE_REUSE",
    "Bitcoin ECDSA Nonce Reuse Challenge (Weak K)",
    "Bitcoin (BTC)",
    "Falha Matemática R-Value",
    "Assinatura com Nonce Repetido ➔ Cálculo Algébrico Instantâneo",
    "15dTwY2K7XjY83j3eTcxL5LwA7hX5N3DqX",
    "1.20 BTC",
    "OPEN (Disponível)",
    "🟢 Instantâneo (Script Algébrico)",
    "2026-09-17T01:57:15.890Z"
  ]
];

  sheetOthers.getRange(2, 1, otherData.length, headersOthers.length).setValues(otherData);
  sheetOthers.setFrozenRows(1);
  sheetOthers.setColumnWidth(1, 120);
  sheetOthers.setColumnWidth(2, 280);
  sheetOthers.setColumnWidth(3, 140);
  sheetOthers.setColumnWidth(5, 250);
  sheetOthers.setColumnWidth(6, 320);

  // ─── ABA 3: RANGES DE VARREDURA (MULTI-CHAIN ANTI-COLISÃO) ───
  let sheetRanges = ss.getSheetByName("Ranges_Varredura");
  if (!sheetRanges) sheetRanges = ss.insertSheet("Ranges_Varredura");

  const headersRanges = [
    "Timestamp", "Rede / Chain", "Desafio / Challenge ID", "Chunk #", "Range Início (Hex)", "Range Fim (Hex)",
    "Worker / Operador", "Status da Varredura", "Hashrate", "Descoberta"
  ];

  sheetRanges.getRange(1, 1, 1, headersRanges.length)
    .setValues([headersRanges])
    .setBackground("#0f172a").setFontColor("#38bdf8")
    .setFontWeight("bold").setHorizontalAlignment("center");
  sheetRanges.setFrozenRows(1);
  sheetRanges.getRange("A:A").setNumberFormat("dd/MM/yyyy hh:mm:ss");
  sheetRanges.setColumnWidth(1, 150);
  sheetRanges.setColumnWidth(2, 90);
  sheetRanges.setColumnWidth(3, 170);

  SpreadsheetApp.getActiveSpreadsheet().toast("Planilha 100% preenchida com Puzzles BTC, ETH, SOL e Multi-Chain Tracking!", "PuzzleRadar", 5);
}

/**
 * Webhook para receber dados do Node.js / Python / C++ Workers com Proteção de Senha e Suporte a Lotes
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var SECRET = "puzzleradar_super_secret_jwt_key_2026_production";
    var FALLBACK_SECRET = "PR_SECURE_WEBHOOK_2026";
    
    // Verificação de Token de Segurança (Corpo da Requisição ou Query Param)
    var clientSecret = data.secretToken || data.secret_token || (e.parameter && e.parameter.secretToken);
    if (!clientSecret || (clientSecret !== SECRET && clientSecret !== FALLBACK_SECRET)) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        code: 401, 
        message: "401 Unauthorized: Token secreto invalido ou ausente" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Ranges_Varredura");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Ranges_Varredura");
    }

    // 1. Processamento em Lote (Batch Mode - Buffer do Backend)
    if ((data.batchMode || data.action === 'batch_ranges') && Array.isArray(data.rows) && data.rows.length > 0) {
      var rowsToInsert = [];
      for (var i = 0; i < data.rows.length; i++) {
        var row = data.rows[i];
        var rChain = row.chain || (row.challengeId && row.challengeId.includes("ETH") ? "ETH" : row.challengeId && row.challengeId.includes("SOL") ? "SOL" : "BTC");
        var rChallengeId = row.challenge_id || row.challengeId || row.puzzleId || "BTC_1000_P71";
        var rChunk = row.chunkIndex !== undefined ? row.chunkIndex : (row.chunkId !== undefined ? row.chunkId : "");
        var rStart = row.startHex || row.rangeStart || "";
        var rEnd = row.endHex || row.rangeEnd || "";
        
        rowsToInsert.push([
          new Date(row.timestamp || Date.now()),
          rChain,
          rChallengeId,
          rChunk,
          "'" + rStart,
          "'" + rEnd,
          row.workerName || "Anonimo",
          row.status || "COMPLETED",
          row.hashrate || "0 GH/s",
          row.keyFound ? "🚨 CHAVE ENCONTRADA!" : "Nada"
        ]);
      }
      
      sheet.insertRowsBefore(2, rowsToInsert.length);
      sheet.getRange(2, 1, rowsToInsert.length, 10).setValues(rowsToInsert);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        processed: rowsToInsert.length,
        message: "Lote de " + rowsToInsert.length + " fatias inserido com sucesso" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Fallback: Modo Linha Única
    var chain = data.chain || (data.challengeId && data.challengeId.includes("ETH") ? "ETH" : data.challengeId && data.challengeId.includes("SOL") ? "SOL" : "BTC");
    var challengeId = data.challengeId || data.challenge_id || data.puzzleId || "BTC_1000_P71";
    var chunk = data.chunkId !== undefined ? data.chunkId : (data.chunkIndex !== undefined ? data.chunkIndex : "");
    var startHex = data.startHex || data.rangeStart || "";
    var endHex = data.endHex || data.rangeEnd || "";
    
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 10).setValues([[
      new Date(),
      chain,
      challengeId,
      chunk,
      "'" + startHex,
      "'" + endHex,
      data.workerName || "Anonimo",
      data.status || "COMPLETED",
      data.hashrate || "0 MK/s",
      data.keyFound ? "🚨 CHAVE ENCONTRADA!" : "Nada"
    ]]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Log inserido no cluster multi-chain com sucesso (Autenticado)" 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}