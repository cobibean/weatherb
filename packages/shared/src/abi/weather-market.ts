// Generated from contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json.
// Intended source version: 2.2.0; this does not upgrade any deployed contract.
export const WEATHER_MARKET_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'UPGRADE_INTERFACE_VERSION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accruedFees',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bettingBufferSeconds',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculatePayout',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'bettor',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancelMarket',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelMarketBySettler',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      {
        name: 'cityId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'resolveTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'thresholdTenths',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currency',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createScheduledMarket',
    inputs: [
      {
        name: 'cityId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'thresholdTenths',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'slot',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'feeBps',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getImpliedPrices',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'yesPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'noPrice',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarket',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IWeatherMarket.Market',
        components: [
          {
            name: 'cityId',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'resolveTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'bettingDeadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'thresholdTenths',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'currency',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'status',
            type: 'uint8',
            internalType: 'enum IWeatherMarket.MarketStatus',
          },
          {
            name: 'yesPool',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'noPool',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'totalFees',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'resolvedTempTenths',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'observedTimestamp',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'outcome',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketCount',
    inputs: [],
    outputs: [
      {
        name: 'count',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'bettor',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IWeatherMarket.Position',
        components: [
          {
            name: 'yesAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'noAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'claimed',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getScheduledMarket',
    inputs: [
      {
        name: 'slot',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_settler',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minBetWei',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'isYes',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'proxiableUUID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'refund',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMarket',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tempTenths',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'observedTimestamp',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBettingBuffer',
    inputs: [
      {
        name: 'newBufferSeconds',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeeBps',
    inputs: [
      {
        name: 'newFeeBps',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMinBet',
    inputs: [
      {
        name: 'newMinBetWei',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSettler',
    inputs: [
      {
        name: 'newSettler',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'settler',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'upgradeToAndCall',
    inputs: [
      {
        name: 'newImplementation',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'version',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'withdrawFees',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'bettor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'isYes',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BettingBufferUpdated',
    inputs: [
      {
        name: 'previousBuffer',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'newBuffer',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ContractPaused',
    inputs: [
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ContractUnpaused',
    inputs: [
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeBpsUpdated',
    inputs: [
      {
        name: 'previousFeeBps',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newFeeBps',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeesWithdrawn',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCancelled',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'cityId',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'resolveTime',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'thresholdTenths',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'currency',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketResolved',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'resolvedTempTenths',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'observedTimestamp',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MinBetUpdated',
    inputs: [
      {
        name: 'previousMinBet',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newMinBet',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Refunded',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'bettor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SettlerUpdated',
    inputs: [
      {
        name: 'previousSettler',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newSettler',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WinningsClaimed',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'claimer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'BetTooSmall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BettingClosed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC1967InvalidImplementation',
    inputs: [
      {
        name: 'implementation',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC1967NonPayable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FailedCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FeeTooHigh',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidInitialization',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMarket',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidParams',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidStatus',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotCancelled',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitializing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotOwner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotResolved',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotSettler',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToClaim',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyNativeCurrency',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Paused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TooEarly',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UUPSUnauthorizedCallContext',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UUPSUnsupportedProxiableUUID',
    inputs: [
      {
        name: 'slot',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;
