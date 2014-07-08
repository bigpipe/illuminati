# Illuminati

### Installation

```
npm install --save-dev illuminati
```

### Usage

Using `illuminati` as test runner is super simple. The only thing you need to
add to your `package.json` is the `illuminati` command in the `scripts.test`
property:

```js
{
  "scripts": {
    "test": "illuminati"
  }
}
```

If you wish to run the tests in `phantomjs` instead you can simply append the
`--phantom` flag and it will do it's thing.

```
{
  "scripts": {
    "test": "illuminati --phantom"
  }
}
```

And that is it. Super simple, but highly opinionated testing.

### License

MIT
