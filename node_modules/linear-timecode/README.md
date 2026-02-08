# Linear Timecode

A pure javascript implementation of a LTC encoder/decoder.


## Features

- [x] LTC decoder
    - [x] Support for 24, 25 and 30 fps
    - [ ] Support for 29.97 fps
    - [x] Support for drop-frame and color-frame
    - [ ] Support for user bits and bgf
- [x] LTC encoder
    - [x] Support for 24, 25 and 30 fps
    - [ ] Support for 29.97 fps
    - [x] Support for drop-frame and color-frame
    - [ ] Support for user bits and bgf
    - [ ] Volume control
    - [ ] Rise and fall time control



## Usage

### Installation


```shell
npm install linear-timecode
```

### Usage

```javascript
const ltc = require('linear-timecode');
const sampleRate = 44100;
let decoder = new ltc.Decoder(sampleRate);
```

or

```javascript
import { Decoder } from "linear-timecode";
const sampleRate = 44100;
let decoder = new Decoder(sampleRate);
```


#### Examples

##### Decoding

- Decode from wav file: [snippet](https://gitlab.com/patopest/linear-timecode-js/-/snippets/3624978).
- Decode from live input source: [snippet](https://gitlab.com/patopest/linear-timecode-js/-/snippets/3624979).


## Development

- Install dependencies

```shell
npm install
```

- Run tests

```shell
npm test
```

- Build library

```shell
npm run build
```


## Useful links

- Linear Timecode [wikipedia](https://en.wikipedia.org/wiki/Linear_timecode).
- Linear Timecode [specification](https://pub.smpte.org/pub/st12-1/st0012-1-2014.pdf).