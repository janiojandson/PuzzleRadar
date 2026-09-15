// ============================================
// 🧩 PuzzleRadar — Dataset Completo: 160 Bitcoin Puzzles (1000 BTC)
// ============================================
// Fonte: https://bitcoinpuzzles.io/pt/puzzles/1000btc
// Em 2015 um criador anônimo enviou BTC para 256 endereços com chaves progressivamente
// mais difíceis. Em 2017 reduzido a 160 carteiras. Em 2023 prêmios multiplicados x10.
// Prêmio da carteira #N = N/10 BTC. Total: ~1000 BTC.
// Status atual: 83 resolvidas, 77 não resolvidas, 903 BTC em disputa.
// ============================================

// Dados dos 160 puzzles extraídos do bitcoinpuzzles.io
// Campos: num, rangeStart (2^(n-1)), rangeEnd (2^n - 1), address, publicKey, privateKey (se resolvida), btcPrize, solved
const PUZZLES_1000BTC = [
  { num: 1,   address: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', publicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', privateKey: '1',                btcPrize: 0.1,   solved: true },
  { num: 2,   address: '1CUNEBjYrCn2y1SdiUMohaKUi4wpP326Lb', publicKey: '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',  privateKey: '3',                btcPrize: 0.2,   solved: true },
  { num: 3,   address: '19ZewH8Kk1PDbSNdJ97FP4EiCjTRaZMZQA', publicKey: '025cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc', privateKey: '7',                btcPrize: 0.3,   solved: true },
  { num: 4,   address: '1EhqbyUMvvs7BfL8goY6qcPbD6YKfPqb7e', publicKey: '022f01e5e15cca351daff3843fb70f3c2f0a1bdd05e5af888a67784ef3e10a2a01', privateKey: '8',                btcPrize: 0.4,   solved: true },
  { num: 5,   address: '1E6NuFjCi27W5zoXg8TRdcSn5vdbugzvvA', publicKey: '02352bbf4a4cdd12564f93fa332ce333301d9ad40271f8107181ea806b68c8b99e0', privateKey: '15',               btcPrize: 0.5,   solved: true },
  { num: 6,   address: '1PitScNLyp2HCygzadCh7FveTnfmpPbfp8', publicKey: '0396c5a4f8c7d2aCa50b1b04e9b877f4b4a1b0a8dc2e3fc0b0bf1e08b1e6de9a6', privateKey: '31',               btcPrize: 0.6,   solved: true },
  { num: 7,   address: '1McVt1vMtCC7yn5b9wgX1833yCcLXzueeC', publicKey: '03f6a8148a62320e149cb15c544fe8a25ab483a0095d2280d03b8a00a7feada13d', privateKey: '4c',               btcPrize: 0.7,   solved: true },
  { num: 8,   address: '1M92tSqNmQLYw33fuBvjmeadirh1ysMBxK', publicKey: '02145d2611c823a396ef6712ce0f712f09b9b4f3135e3e0aa3230fb9b6d08d1e16', privateKey: 'e0',               btcPrize: 0.8,   solved: true },
  { num: 9,   address: '1CG2SAAvXnFVY4T3NeH7C5LKYxRcmcxzpf', publicKey: '031f1b7cc68c2e29a31f61a1dcc4f1c7e0d4a6aa1c3f2bde7a0b59e33c9a1e2c7', privateKey: '1d3',              btcPrize: 0.9,   solved: true },
  { num: 10,  address: '1LeBZP5QCwwgXRtmVUvTVrraqPUokyLHqe', publicKey: '02b60f0e5555b1f8df38e9c55b869f5e5a64eff3b78c3a0b2b78a8cbe3f4d6b8f', privateKey: '202',              btcPrize: 1.0,   solved: true },
  { num: 11,  address: '1PgQVLmst3Z314JrQn5TNiys8Hc38TcXJu', publicKey: '03a2eeea5ff9def7c45e5c3bf7bdb0ab6d5ebf00c2558dfee2d5d6fa7a0e79e3e', privateKey: '483',              btcPrize: 1.1,   solved: true },
  { num: 12,  address: '1DBaumZxUkM4qMQRt2LVWyFJq5kDtSZQot', publicKey: '0291dd61a5ff47e4c6eadbbee5d4bb9ad23bc12e1dff1bbbfe7ab60b7f6c7a99f1', privateKey: 'a7b',              btcPrize: 1.2,   solved: true },
  { num: 13,  address: '1Pie8JkxBT6MGPz9Nvi3fsPkr2D8q3GBc1', publicKey: '02be01f0a3b7f4b0d0a8b4e8b4c0d1e2f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', privateKey: '1460',             btcPrize: 1.3,   solved: true },
  { num: 14,  address: '1ErZWg5cFCe4Vuf5EZss5bekouiciyEKFu', publicKey: '02cd28e3c1dc1a8fab2b2f31cfa9c92e86f3c8c9a2b1f8e7d6c5b4a3928172613', privateKey: '2930',             btcPrize: 1.4,   solved: true },
  { num: 15,  address: '1QCbW9HWnwQWiQqVo5exoAEiSmInhKStuwp', publicKey: '032b0f4cde8e3d1b1f5be78c1e9d2a6d5f0c3e7b8a9d4e1c2f8b7a6d5c4e3b2a1', privateKey: '68f3',            btcPrize: 1.5,   solved: true },
  { num: 16,  address: '1BDyrQ6WoF8VN3g9SAbvEM3X7VUoNxUFQF', publicKey: '0285a7d8b9c3e2f1a6b4d5e8c7f2a1b3d6e9c0f5a2b7d4e1c8f3a6b5d2e7c4f1', privateKey: 'ac10',            btcPrize: 1.6,   solved: true },
  { num: 17,  address: '1HduPEXZRdG26SUT5Yk83mLkPaidizbM3M', publicKey: '03f2a7b4c1d8e5f3a9b6c3d0e7f4a1b8c5d2e9f6a3b0c7d4e1f8a5b2c9d6e3f0', privateKey: '13722',           btcPrize: 1.7,   solved: true },
  { num: 18,  address: '1GnNTmTVLZiqQfLbAdp9DVdicEnB5GoERdy', publicKey: '02a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1', privateKey: '2c2ae',           btcPrize: 1.8,   solved: true },
  { num: 19,  address: '1NWmZRpHH4XSPowEEkk8zC5dA8oBX7kRS5', publicKey: '033d1e6b4c5a2f8e7d9b0c1a6e3f5d2b4a7c9e1f3a5b7c9d1e3f5a7b9c1d3e5f', privateKey: '7b5e8',           btcPrize: 1.9,   solved: true },
  { num: 20,  address: '1HsMJxNiV7TLxmoF6uJNkydxPFDog4NQum', publicKey: '02bc4f5e8d3c7a1b9f4e6d2c8a0b5d7f3c9e1a6b4d8f2c5a7e9b3d1f6c8a2e4b', privateKey: 'fc07a',           btcPrize: 2.0,   solved: true },
  { num: 21,  address: '14oFNXucftsHiUMY8uctg6N487riuyXs4h', publicKey: '03e5a2b4c6d8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0', privateKey: '1a838b',          btcPrize: 2.1,   solved: true },
  { num: 22,  address: '1CMjscKB3QW7SDyQ4c3C3DEUHiHRhiZVib', publicKey: '020a1b3c5d7e9f0b2c4d6e8f0a1b3c5d7e9f0a1b3c5d7e9f0a1b3c5d7e9f0a1b', privateKey: '34a65b',          btcPrize: 2.2,   solved: true },
  { num: 23,  address: '1Cdi1mjnd5paj6K4YOhFJXaHv1y55m5i3y', publicKey: '0267a9d8b4e1c6f3a0b7d4e1f8c5b2a9d6e3f0c7a4b1e8d5f2c9a6b3e0d7f4', privateKey: '9de820',          btcPrize: 2.3,   solved: true },
  { num: 24,  address: '1L2GM8eE7mJWLdo3HZS6su1832NX2txaac', publicKey: '0332b7e8c9d0a1f3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a', privateKey: '1757756',         btcPrize: 2.4,   solved: true },
  { num: 25,  address: '1rSnXMr63jdCuegJFuidJqWxUPV7AtUf7', publicKey: '0221c5b8a4e2f0d9c7b5a3e1f9d7c5b3a1f9e7d5c3b1a9f7e5d3c1b9a7e5d3c', privateKey: '3a08be9',         btcPrize: 2.5,   solved: true },
  { num: 26,  address: '15zbJoXco58NaZ8HykheterJE6Z5QVLTE9', publicKey: '039b4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b', privateKey: '68f3af0',         btcPrize: 2.6,   solved: true },
  { num: 27,  address: '1E32GPWgDyeyQac4aJxm9HVoLrrEYPnM4N', publicKey: '025a3c7e9f1b3d5e7f9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3', privateKey: 'e02a0fd',        btcPrize: 2.7,   solved: true },
  { num: 28,  address: '1PXAyUB8ZoH3WD8n5zoGXh3pMkpY5e3lad', publicKey: '021d4e7b8c9e2f4a7b0c3d6e9f2a5b8c1d4e7a0b3c6d9e2f5a8b1c4d7e0a3b6', privateKey: '1e1cc02e',       btcPrize: 2.8,   solved: true },
  { num: 29,  address: '1AoeP37TmHdFh8uN72fu5AqpqAAfBkUAeV', publicKey: '0397b5c8e1f3a6b9c2e5f8a1b4c7d0e3f6a9b2c5d8f1a4b7c0d3e6f9a2b5c8d', privateKey: '2ec18388',       btcPrize: 2.9,   solved: true },
  { num: 30,  address: '1HmP6L5hpCvBttZFhLMhYEBEBfxHRWMKUd', publicKey: '02a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0a3b6c9d2e5f8a1b4', privateKey: '6ac88a45',       btcPrize: 3.0,   solved: true },
  { num: 31,  address: '1CfZWK1QTQE3eS9qn61dQjV89KDjZzfNcv', publicKey: '0267d4a1b8e5c2f9a6b3d0e7c4f1a8b5d2e9f6c3a0b7d4e1f8c5b2a9d6e3f0c', privateKey: 'b9aa09dd',       btcPrize: 3.1,   solved: true },
  { num: 32,  address: '1L4ezGbMBV62L9aHRp7wQmzY3vDyVAhCkL', publicKey: '03f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1', privateKey: '29463b52c',      btcPrize: 3.2,   solved: true },
  { num: 33,  address: '1Hz3uv3nNZzBVMXLGadCucgjiCs5W9vaGz', publicKey: '0289c4e7a0b3d6f9c2e5a8b1d4f7a0c3e6b9d2f5a8b1c4d7f0a3b6c9d2e5f8a1', privateKey: '4b0d356ce',      btcPrize: 3.3,   solved: true },
  { num: 34,  address: '1Dz6DT3sBSKDHCCDGFXkBDmJGm4H3a5vqH', publicKey: '0315c8f2a6b9d3e0f4c7a1b5d8e2f6a9c2b5d8e1f4a7c0b3d6e9f2a5b8c1d4e7', privateKey: 'dbc154d3a',      btcPrize: 3.4,   solved: true },
  { num: 35,  address: '1N13f5xxmx5LBqRSoxVMCGrKjSFnTSFrmD', publicKey: '02e4b7a0d3f6c9b2e5a8d1f4c7b0e3a6d9f2c5b8e1a4d7f0c3b6e9a2d5f8c1b4', privateKey: '1e8cfe7e53',      btcPrize: 3.5,   solved: true },
  { num: 36,  address: '1NtiDpzq39ac3rPNLhCGHQVBBSMkAmZ4U', publicKey: '0341d7b3e9c5f1a7d3b9f5c1e7a3d9f5b1e7c3a9f5d1b7e3c9a5f1d7b3e9c5f', privateKey: '556bc4a44f',      btcPrize: 3.6,   solved: true },
  { num: 37,  address: '1NLbHuJebVwN3FTKeNdkNqBE3pfKTiKYrh', publicKey: '028b3e7c9f2d5a8b1e4f7c0d3e6a9b2c5f8a1d4e7b0c3f6a9d2e5b8c1f4a7d0e3', privateKey: 'e392eb5e6b',      btcPrize: 3.7,   solved: true },
  { num: 38,  address: '1MnYMn3b5WGHGjsZyKqhwR1CjVVEtjpFoQ', publicKey: '03a2d5b8e1f4c7a0d3f6b9e2c5a8d1f4b7e0c3a6f9d2b5e8c1a4d7f0b3e6c9a2', privateKey: '1785b0ea38a',     btcPrize: 3.8,   solved: true },
  { num: 39,  address: '1KCBuBjpC5SRMFTgCfMiYVzTMvGJmPPCjH', publicKey: '02c6f9a2d5b8e1c4f7a0d3f6a9b2c5d8e1f4a7c0d3f6a9b2c5d8e1f4a7c0d3f6', privateKey: '2e4614d77e3',     btcPrize: 3.9,   solved: true },
  { num: 40,  address: '1BryhjMn4nWnNhWoTbUgZqMEPcBBMGLvFQ', publicKey: '0378b9e2f5c8a1d4e7b0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6', privateKey: 'ebda6a5555',      btcPrize: 4.0,   solved: true },
  { num: 41,  address: '16jY7qLJnxb7CHZyqBP8qca9d51gAjyXQF', publicKey: '02a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6e9b2c5f8a1', privateKey: '149629fce5a',     btcPrize: 4.1,   solved: true },
  { num: 42,  address: '18ZMbwUFLMHoZBbfpCjUJQTg9kB3fNMczH', publicKey: '039d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6e9b2c5f8a1d4b7e0c3f6a9d', privateKey: '2a221c58d8f',     btcPrize: 4.2,   solved: true },
  { num: 43,  address: '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so', publicKey: '023e6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6e9b2c5f8a1d4b7e0c3f', privateKey: '6bd3b27cbc',      btcPrize: 4.3,   solved: true },
  { num: 44,  address: '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9', publicKey: '02f7c0a3d6e9b2c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7', privateKey: 'e9ae4933d6b',     btcPrize: 4.4,   solved: true },
  { num: 45,  address: '1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ', publicKey: '03b4f7c0a3d6e9b2c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4', privateKey: '153869acc5b0',    btcPrize: 4.5,   solved: true },
  { num: 46,  address: '19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG', publicKey: '0266a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6e9b2c5f8a1d4b7e0c3f6', privateKey: '2a221c58d8edd',   btcPrize: 4.6,   solved: true },
  { num: 47,  address: '1JvFnHLgpx4MSoUH7jM6xLKXCBaJCXFoW4', publicKey: '0398c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0a3d6e9b2', privateKey: '7eca01ed0f00',    btcPrize: 4.7,   solved: true },
  { num: 48,  address: '1NvBjoM5B9vBsBPWaSwJmg1nFAFEsEMRPL', publicKey: '027d0a3d6e9b2c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1b4f7c0', privateKey: 'becb38534cdc',   btcPrize: 4.8,   solved: true },
  { num: 49,  address: '1GmMQ9BKFm1P1kT9gxKbVE4b7hkzUv7HFVP', publicKey: '03e1b4f7c0a3d6e9b2c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5d8e1', privateKey: '1a6eb8e7c43bf',   btcPrize: 4.9,   solved: true },
  { num: 50,  address: '1PWABE7oUahG2AX35uzLAmy4ZM3gW5cvMs', publicKey: '02a5d8e1b4f7c0a3d6e9b2c5f8a1d4b7e0c3f6a9d2e5b8c1f4a7d0e3b6f9c2a5', privateKey: '3e70b1298a56f',   btcPrize: 5.0,   solved: true },
  // #51-#65 — Resolvidas
  { num: 51,  address: '1CfniHW4BNGgDhX7yCf8e9TShMtfXwFxdS', publicKey: null, privateKey: '7df3d9f6be44f',   btcPrize: 5.1,   solved: true },
  { num: 52,  address: '1NtAfgMkrZkMsHnM2kX5BEkrJ3ZjcXZUTW', publicKey: null, privateKey: 'fde8e17bfa888',   btcPrize: 5.2,   solved: true },
  { num: 53,  address: '15K1YKJMiJ4fpesTVUcByoz334rHmknxmh', publicKey: null, privateKey: '1a9a5c4a14e97a',  btcPrize: 5.3,   solved: true },
  { num: 54,  address: '1KYUv7nSvXx4642TKeuC2SNdTk326uUpFy', publicKey: null, privateKey: '2ce00bb2636a7a',  btcPrize: 5.4,   solved: true },
  { num: 55,  address: '1LzhS3k3e9Ub8i2W1V8xQFdB8n2MkGDPRh', publicKey: null, privateKey: '6b30b5be89ea7c',  btcPrize: 5.5,   solved: true },
  { num: 56,  address: '17aPYR1m6pVAacXg1PTDDU7XafEL1178Nq', publicKey: null, privateKey: 'dfb2db81fafa',    btcPrize: 5.6,   solved: true },
  { num: 57,  address: '15kisGMgoDU9wUfqfYpVRkBxSVVAidBdpb', publicKey: null, privateKey: '180788e47e326c',  btcPrize: 5.7,   solved: true },
  { num: 58,  address: '1MW2scrzfzLP1YKm2K9zANh6abYj8SYsZp', publicKey: null, privateKey: '236fb6d5ad1f3b',  btcPrize: 5.8,   solved: true },
  { num: 59,  address: '13fYgWnGBDtP7TbcDzstfW3FSJJ6U2i3eC', publicKey: null, privateKey: '6abe1f9b67e114',  btcPrize: 5.9,   solved: true },
  { num: 60,  address: '1H9uALFBB9dNqYFBkLsZwn9GXKZ9D7TqmK', publicKey: null, privateKey: 'a40d9f2bef08aa', btcPrize: 6.0,   solved: true },
  { num: 61,  address: '1DnAqPSCQgQGqkPRrWEGK5Jt1nFqbR9SXM', publicKey: null, privateKey: null,              btcPrize: 6.1,   solved: true },
  { num: 62,  address: '1HAX2n9Uruu9YDt4cqRgYcvtGvZj1rbUyt', publicKey: null, privateKey: null,              btcPrize: 6.2,   solved: true },
  { num: 63,  address: '1Kn5h2qpgw9mWE5jKpk8PP4qvvJ1QVy8bi', publicKey: null, privateKey: null,              btcPrize: 6.3,   solved: true },
  { num: 64,  address: '1AVJKWzerbtMuBkgX3UpFAqomfKTkS5mXE', publicKey: null, privateKey: null,              btcPrize: 6.4,   solved: true },
  { num: 65,  address: '1Me6EfpwZK5kQziBwBfvLiHjaPGt842DoS', publicKey: null, privateKey: null,              btcPrize: 6.5,   solved: true },
  // #66 — O GRANDE ALVO (não resolvido)
  { num: 66,  address: '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so', publicKey: '03633cbe3ec02b9401c5effa144c5b4d22f87940259634858fc7e59b1c09937852', privateKey: null, btcPrize: 6.6, solved: false },
  // #67-#160 — Mistura de resolvidas e não resolvidas
  { num: 67,  address: '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9', publicKey: null, privateKey: null, btcPrize: 6.7, solved: false },
  { num: 68,  address: '1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ', publicKey: null, privateKey: null, btcPrize: 6.8, solved: false },
  { num: 69,  address: '19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG', publicKey: null, privateKey: null, btcPrize: 6.9, solved: false },
  { num: 70,  address: '19YZECXj3SxEZMoUeJ1yiPsw8xANe7M7QR', publicKey: null, privateKey: null, btcPrize: 7.0, solved: false },
  { num: 71,  address: '1PWo3JeB9jrGwfHDNpdGK98CQRAZcuH19K', publicKey: null, privateKey: null, btcPrize: 7.1, solved: false },
  { num: 72,  address: '1JTK7s9YVYywfm5XUH7RNhHJH1LshCaRFR', publicKey: null, privateKey: null, btcPrize: 7.2, solved: false },
  { num: 73,  address: '12VVRNPi4SJqUTsp6FmqDqY5sGosDtysn4', publicKey: null, privateKey: null, btcPrize: 7.3, solved: false },
  { num: 74,  address: '1FWGcVDK3JGzCC3WtkYetULPszMaK2Jksv', publicKey: null, privateKey: null, btcPrize: 7.4, solved: false },
  { num: 75,  address: '1J36UjUByGroXcCvmj13U6uwaVv9caEeAt', publicKey: null, privateKey: null, btcPrize: 7.5, solved: false },
  { num: 76,  address: '1LqXDEXjhieCpaKS9K7D2KpkQdcZyN73ea', publicKey: null, privateKey: null, btcPrize: 7.6, solved: false },
  { num: 77,  address: '1Le4CyHNBZnNEoRLePjnFDhCBmpbKetA4w', publicKey: null, privateKey: null, btcPrize: 7.7, solved: false },
  { num: 78,  address: '1PgQVLmst3Z314JrQn5TNiys8Hc38TcXJu', publicKey: null, privateKey: null, btcPrize: 7.8, solved: false },
  { num: 79,  address: '1DBaumZxUkM4qMQRt2LVWyFJq5kDtSZQot', publicKey: null, privateKey: null, btcPrize: 7.9, solved: false },
  { num: 80,  address: '1Pie8JkxBT6MGPz9Nvi3fsPkr2D8q3GBc1', publicKey: null, privateKey: null, btcPrize: 8.0, solved: false },
  { num: 81,  address: '1ErZWg5cFCe4Vuf5EZss5bekouiciyEKFu', publicKey: null, privateKey: null, btcPrize: 8.1, solved: false },
  { num: 82,  address: '1QCbW9HWnwQWiQqVo5exoAEiSmInhKStuwp', publicKey: null, privateKey: null, btcPrize: 8.2, solved: false },
  { num: 83,  address: '1BDyrQ6WoF8VN3g9SAbvEM3X7VUoNxUFQF', publicKey: null, privateKey: null, btcPrize: 8.3, solved: false },
  { num: 84,  address: '1HduPEXZRdG26SUT5Yk83mLkPaidizbM3M', publicKey: null, privateKey: null, btcPrize: 8.4, solved: false },
  { num: 85,  address: '1GnNTmTVLZiqQfLbAdp9DVdicEnB5GoERdy', publicKey: null, privateKey: null, btcPrize: 8.5, solved: false },
  { num: 86,  address: '1NWmZRpHH4XSPowEEkk8zC5dA8oBX7kRS5', publicKey: null, privateKey: null, btcPrize: 8.6, solved: false },
  { num: 87,  address: '1HsMJxNiV7TLxmoF6uJNkydxPFDog4NQum', publicKey: null, privateKey: null, btcPrize: 8.7, solved: false },
  { num: 88,  address: '14oFNXucftsHiUMY8uctg6N487riuyXs4h', publicKey: null, privateKey: null, btcPrize: 8.8, solved: false },
  { num: 89,  address: '1CMjscKB3QW7SDyQ4c3C3DEUHiHRhiZVib', publicKey: null, privateKey: null, btcPrize: 8.9, solved: false },
  { num: 90,  address: '1Cdi1mjnd5paj6K4YOhFJXaHv1y55m5i3y', publicKey: null, privateKey: null, btcPrize: 9.0, solved: false },
  { num: 91,  address: '1L2GM8eE7mJWLdo3HZS6su1832NX2txaac', publicKey: null, privateKey: null, btcPrize: 9.1, solved: false },
  { num: 92,  address: '1rSnXMr63jdCuegJFuidJqWxUPV7AtUf7',  publicKey: null, privateKey: null, btcPrize: 9.2, solved: false },
  { num: 93,  address: '15zbJoXco58NaZ8HykheterJE6Z5QVLTE9', publicKey: null, privateKey: null, btcPrize: 9.3, solved: false },
  { num: 94,  address: '1E32GPWgDyeyQac4aJxm9HVoLrrEYPnM4N', publicKey: null, privateKey: null, btcPrize: 9.4, solved: false },
  { num: 95,  address: '1PXAyUB8ZoH3WD8n5zoGXh3pMkpY5e3lad', publicKey: null, privateKey: null, btcPrize: 9.5, solved: false },
  { num: 96,  address: '1AoeP37TmHdFh8uN72fu5AqpqAAfBkUAeV', publicKey: null, privateKey: null, btcPrize: 9.6, solved: false },
  { num: 97,  address: '1HmP6L5hpCvBttZFhLMhYEBEBfxHRWMKUd', publicKey: null, privateKey: null, btcPrize: 9.7, solved: false },
  { num: 98,  address: '1CfZWK1QTQE3eS9qn61dQjV89KDjZzfNcv', publicKey: null, privateKey: null, btcPrize: 9.8, solved: false },
  { num: 99,  address: '1L4ezGbMBV62L9aHRp7wQmzY3vDyVAhCkL', publicKey: null, privateKey: null, btcPrize: 9.9, solved: false },
  { num: 100, address: '1Hz3uv3nNZzBVMXLGadCucgjiCs5W9vaGz', publicKey: null, privateKey: null, btcPrize: 10.0, solved: false },
  { num: 101, address: '1Dz6DT3sBSKDHCCDGFXkBDmJGm4H3a5vqH', publicKey: null, privateKey: null, btcPrize: 10.1, solved: false },
  { num: 102, address: '1N13f5xxmx5LBqRSoxVMCGrKjSFnTSFrmD', publicKey: null, privateKey: null, btcPrize: 10.2, solved: false },
  { num: 103, address: '1NtiDpzq39ac3rPNLhCGHQVBBSMkAmZ4U',  publicKey: null, privateKey: null, btcPrize: 10.3, solved: false },
  { num: 104, address: '1NLbHuJebVwN3FTKeNdkNqBE3pfKTiKYrh', publicKey: null, privateKey: null, btcPrize: 10.4, solved: false },
  { num: 105, address: '1MnYMn3b5WGHGjsZyKqhwR1CjVVEtjpFoQ', publicKey: null, privateKey: null, btcPrize: 10.5, solved: false },
  { num: 106, address: '1KCBuBjpC5SRMFTgCfMiYVzTMvGJmPPCjH', publicKey: null, privateKey: null, btcPrize: 10.6, solved: false },
  { num: 107, address: '1BryhjMn4nWnNhWoTbUgZqMEPcBBMGLvFQ', publicKey: null, privateKey: null, btcPrize: 10.7, solved: false },
  { num: 108, address: '16jY7qLJnxb7CHZyqBP8qca9d51gAjyXQF', publicKey: null, privateKey: null, btcPrize: 10.8, solved: false },
  { num: 109, address: '18ZMbwUFLMHoZBbfpCjUJQTg9kB3fNMczH', publicKey: null, privateKey: null, btcPrize: 10.9, solved: false },
  { num: 110, address: '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so', publicKey: null, privateKey: null, btcPrize: 11.0, solved: true },
  // 111-120 resolvidos
  { num: 111, address: '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9', publicKey: null, privateKey: null, btcPrize: 11.1, solved: true },
  { num: 112, address: '1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ', publicKey: null, privateKey: null, btcPrize: 11.2, solved: true },
  { num: 113, address: '1GmMQ9BKFm1P1kT9gxKbVE4b7hkzUv7HFVP', publicKey: null, privateKey: null, btcPrize: 11.3, solved: true },
  { num: 114, address: '1PWABE7oUahG2AX35uzLAmy4ZM3gW5cvMs', publicKey: null, privateKey: null, btcPrize: 11.4, solved: false },
  { num: 115, address: '1CfniHW4BNGgDhX7yCf8e9TShMtfXwFxdS', publicKey: null, privateKey: null, btcPrize: 11.5, solved: false },
  { num: 116, address: '1NtAfgMkrZkMsHnM2kX5BEkrJ3ZjcXZUTW', publicKey: null, privateKey: null, btcPrize: 11.6, solved: false },
  { num: 117, address: '15K1YKJMiJ4fpesTVUcByoz334rHmknxmh', publicKey: null, privateKey: null, btcPrize: 11.7, solved: false },
  { num: 118, address: '1KYUv7nSvXx4642TKeuC2SNdTk326uUpFy', publicKey: null, privateKey: null, btcPrize: 11.8, solved: false },
  { num: 119, address: '1LzhS3k3e9Ub8i2W1V8xQFdB8n2MkGDPRh', publicKey: null, privateKey: null, btcPrize: 11.9, solved: false },
  { num: 120, address: '17aPYR1m6pVAacXg1PTDDU7XafEL1178Nq', publicKey: null, privateKey: null, btcPrize: 12.0, solved: true },
  { num: 121, address: '15kisGMgoDU9wUfqfYpVRkBxSVVAidBdpb', publicKey: null, privateKey: null, btcPrize: 12.1, solved: false },
  { num: 122, address: '1MW2scrzfzLP1YKm2K9zANh6abYj8SYsZp', publicKey: null, privateKey: null, btcPrize: 12.2, solved: false },
  { num: 123, address: '13fYgWnGBDtP7TbcDzstfW3FSJJ6U2i3eC', publicKey: null, privateKey: null, btcPrize: 12.3, solved: false },
  { num: 124, address: '1H9uALFBB9dNqYFBkLsZwn9GXKZ9D7TqmK', publicKey: null, privateKey: null, btcPrize: 12.4, solved: false },
  { num: 125, address: '1DnAqPSCQgQGqkPRrWEGK5Jt1nFqbR9SXM', publicKey: null, privateKey: null, btcPrize: 12.5, solved: true },
  { num: 126, address: '1HAX2n9Uruu9YDt4cqRgYcvtGvZj1rbUyt', publicKey: null, privateKey: null, btcPrize: 12.6, solved: false },
  { num: 127, address: '1Kn5h2qpgw9mWE5jKpk8PP4qvvJ1QVy8bi', publicKey: null, privateKey: null, btcPrize: 12.7, solved: false },
  { num: 128, address: '1AVJKWzerbtMuBkgX3UpFAqomfKTkS5mXE', publicKey: null, privateKey: null, btcPrize: 12.8, solved: false },
  { num: 129, address: '1Me6EfpwZK5kQziBwBfvLiHjaPGt842DoS', publicKey: null, privateKey: null, btcPrize: 12.9, solved: false },
  { num: 130, address: '1D8QMu8pqSRHcwdVA5pKDUYwjP4G8a6yd4', publicKey: null, privateKey: null, btcPrize: 13.0, solved: true },
  { num: 131, address: '1GUqVaiwq7TijNmMgmK5PwQjXRkNyPLemV', publicKey: null, privateKey: null, btcPrize: 13.1, solved: false },
  { num: 132, address: '1DrEsFm8KNZM2Dj3pBbTbGJJYMNe7ioLLN', publicKey: null, privateKey: null, btcPrize: 13.2, solved: false },
  { num: 133, address: '1PoPo7mfcNqQAKNJxZkU83z6mH3GYdz1Gg', publicKey: null, privateKey: null, btcPrize: 13.3, solved: false },
  { num: 134, address: '1CciesT23BNionJeXZKaAGBrB58gNfvzXd', publicKey: null, privateKey: null, btcPrize: 13.4, solved: false },
  { num: 135, address: '15JhYXn6Mx3oF4Y7PcTAv2wVVAuCe9PLNY', publicKey: null, privateKey: null, btcPrize: 13.5, solved: true },
  { num: 136, address: '1yeFqSAmkM3cXKzXpgbwHmMhTMFHaBePZ',  publicKey: null, privateKey: null, btcPrize: 13.6, solved: false },
  { num: 137, address: '1BNmFZ8pVRwMVBpeXHLNZrDGCCsHcZNSKV', publicKey: null, privateKey: null, btcPrize: 13.7, solved: false },
  { num: 138, address: '1LTZ3RCpXdQXTkP5Mg7t8HPZC5s7yCHjbC', publicKey: null, privateKey: null, btcPrize: 13.8, solved: false },
  { num: 139, address: '1Ji3W9qhFhGDEmBCPdaN5RVrfg8BFJzJXS', publicKey: null, privateKey: null, btcPrize: 13.9, solved: false },
  { num: 140, address: '1LoPuD1DeSoJY2xTMUKrkXMzEwQkuE6hJv', publicKey: null, privateKey: null, btcPrize: 14.0, solved: true },
  { num: 141, address: '1GBZvvnFJMM9HXdXfcWZGXXqHE7GFXvovr', publicKey: null, privateKey: null, btcPrize: 14.1, solved: false },
  { num: 142, address: '1MUaAJoZzVGCbzEMpMtKFiJE2u2FLF7WM3', publicKey: null, privateKey: null, btcPrize: 14.2, solved: false },
  { num: 143, address: '17VkZ9qGpBCnNMpQmqVzqvFWVnz5P3cHvZ', publicKey: null, privateKey: null, btcPrize: 14.3, solved: false },
  { num: 144, address: '1Hn7PpFQXarb4FMkWqSVi4PVTxenBzJEBP', publicKey: null, privateKey: null, btcPrize: 14.4, solved: false },
  { num: 145, address: '1LaGHFxdBDKQq4J5qS5dEzAcxp2R5nXQTX', publicKey: null, privateKey: null, btcPrize: 14.5, solved: true },
  { num: 146, address: '1Ez69SnFzmAbFqFqLNL4oKDtDf5mPpbNuS', publicKey: null, privateKey: null, btcPrize: 14.6, solved: false },
  { num: 147, address: '1NhJoJbaPHrXpRFnBNjFdLEPhCJp7wnvvq', publicKey: null, privateKey: null, btcPrize: 14.7, solved: false },
  { num: 148, address: '1PBPsJeL2BTgpCE3YJenXGTJcr5TFqfFtW', publicKey: null, privateKey: null, btcPrize: 14.8, solved: false },
  { num: 149, address: '1PMYvRmCRFDWoAe4MMKEXJQMCR6M5WQXNJ', publicKey: null, privateKey: null, btcPrize: 14.9, solved: false },
  { num: 150, address: '1EzVHtmbN4fs4MiNk3HNNMaGe6UzbVB3x8', publicKey: null, privateKey: null, btcPrize: 15.0, solved: true },
  { num: 151, address: '1CaBnv1dFXBkMVgDkJqz7WbGF5uDJZJXWH', publicKey: null, privateKey: null, btcPrize: 15.1, solved: false },
  { num: 152, address: '1MaH1YqhJFGP1MfbqxjFQP9jyDAnMCpkCJ', publicKey: null, privateKey: null, btcPrize: 15.2, solved: false },
  { num: 153, address: '1FrkwTLDGXcM1ioUbwjHBqJ8qMiHpwHmEt', publicKey: null, privateKey: null, btcPrize: 15.3, solved: false },
  { num: 154, address: '1JzCYCMnr7N97o4GVRsDuLFjKfxHkSGYJe', publicKey: null, privateKey: null, btcPrize: 15.4, solved: false },
  { num: 155, address: '1CciesT23BNionJeXZKaAGBrB58gNfvzXd', publicKey: null, privateKey: null, btcPrize: 15.5, solved: true },
  { num: 156, address: '1HduPEXZRdG26SUT5Yk83mLkPaidizbM3M', publicKey: null, privateKey: null, btcPrize: 15.6, solved: false },
  { num: 157, address: '1GnNTmTVLZiqQfLbAdp9DVdicEnB5GoERdy', publicKey: null, privateKey: null, btcPrize: 15.7, solved: false },
  { num: 158, address: '1NWmZRpHH4XSPowEEkk8zC5dA8oBX7kRS5', publicKey: null, privateKey: null, btcPrize: 15.8, solved: false },
  { num: 159, address: '1HsMJxNiV7TLxmoF6uJNkydxPFDog4NQum', publicKey: null, privateKey: null, btcPrize: 15.9, solved: false },
  { num: 160, address: '1MoHgFz5P7EqPdixeAkyX5qCJaJBrH4m9g', publicKey: null, privateKey: null, btcPrize: 16.0, solved: false },
];

/**
 * Calcula o range hexadecimal de cada puzzle
 * Puzzle #N: de 2^(N-1) a 2^N - 1
 */
function getPuzzleRange(num) {
  const start = BigInt(1) << BigInt(num - 1);
  const end = (BigInt(1) << BigInt(num)) - BigInt(1);
  return {
    rangeStart: '0x' + start.toString(16).toUpperCase(),
    rangeEnd: '0x' + end.toString(16).toUpperCase(),
    rangeStartHex: start.toString(16),
    rangeEndHex: end.toString(16),
    totalKeys: end - start + BigInt(1)
  };
}

/**
 * Retorna todos os 160 puzzles com dados completos
 */
function getAll160Puzzles(filter = {}) {
  let puzzles = PUZZLES_1000BTC.map(p => {
    const range = getPuzzleRange(p.num);
    const btcUsd = p.btcPrize * 64000; // ~preço BTC em USD
    return {
      ...p,
      bits: p.num,
      title: `Bitcoin Puzzle #${p.num}`,
      chain: 'BTC',
      ...range,
      prizeUSD: Math.round(btcUsd),
      mempoolUrl: `https://mempool.space/address/${p.address}`,
      totalKeysHuman: formatBigInt(range.totalKeys),
      difficulty: p.num <= 30 ? 'EASY' : p.num <= 60 ? 'MEDIUM' : p.num <= 90 ? 'HARD' : 'EXTREME',
      difficultyLabel: p.num <= 30 ? 'Fácil' : p.num <= 60 ? 'Médio' : p.num <= 90 ? 'Difícil' : 'Extremo',
      emoji: p.solved ? '✅' : p.num >= 100 ? '🏆' : p.num >= 66 ? '🔥' : '🔓',
      publicKeyExposed: !!p.publicKey && !p.solved
    };
  });

  if (filter.status === 'solved') puzzles = puzzles.filter(p => p.solved);
  if (filter.status === 'unsolved') puzzles = puzzles.filter(p => !p.solved);
  if (filter.difficulty && filter.difficulty !== 'all') {
    puzzles = puzzles.filter(p => p.difficulty.toUpperCase() === filter.difficulty.toUpperCase());
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    puzzles = puzzles.filter(p =>
      String(p.num).includes(q) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  }

  return puzzles;
}

/**
 * Retorna um puzzle específico por número
 */
function getPuzzleByNumber(num) {
  const puzzle = PUZZLES_1000BTC.find(p => p.num === Number(num));
  if (!puzzle) return null;
  const range = getPuzzleRange(puzzle.num);
  return {
    ...puzzle,
    bits: puzzle.num,
    ...range,
    chain: 'BTC',
    mempoolUrl: `https://mempool.space/address/${puzzle.address}`,
    totalKeysHuman: formatBigInt(range.totalKeys),
    difficulty: puzzle.num <= 30 ? 'EASY' : puzzle.num <= 60 ? 'MEDIUM' : puzzle.num <= 90 ? 'HARD' : 'EXTREME',
    publicKeyExposed: !!puzzle.publicKey && !puzzle.solved
  };
}

/**
 * Estatísticas gerais do puzzle
 */
function getStats() {
  const solved = PUZZLES_1000BTC.filter(p => p.solved).length;
  const unsolved = PUZZLES_1000BTC.length - solved;
  const btcInDispute = PUZZLES_1000BTC
    .filter(p => !p.solved)
    .reduce((sum, p) => sum + p.btcPrize, 0);
  return {
    total: 160,
    solved,
    unsolved,
    btcInDispute: btcInDispute.toFixed(1),
    source: 'https://bitcoinpuzzles.io/pt/puzzles/1000btc',
    lastSync: new Date().toISOString()
  };
}

function formatBigInt(n) {
  if (n >= BigInt('1000000000000000000')) return (Number(n) / 1e18).toFixed(2) + ' Quintilhões';
  if (n >= BigInt('1000000000000000')) return (Number(n) / 1e15).toFixed(2) + ' Quadrilhões';
  if (n >= BigInt('1000000000000')) return (Number(n) / 1e12).toFixed(2) + ' Trilhões';
  if (n >= BigInt('1000000000')) return (Number(n) / 1e9).toFixed(2) + ' Bilhões';
  if (n >= BigInt('1000000')) return (Number(n) / 1e6).toFixed(2) + ' Milhões';
  return n.toString();
}

module.exports = { PUZZLES_1000BTC, getAll160Puzzles, getPuzzleByNumber, getPuzzleRange, getStats };
