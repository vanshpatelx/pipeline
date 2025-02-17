# Multi-Language Turbo Setup


## Python (Poetry) Setup
```sh
poetry init
poetry add fastapi uvicorn
```

### `package.json`
```json
{
  "scripts": {
    "dev": "/Users/vansh/.local/bin/poetry run uvicorn src.main:app --reload"
  }
}
```

```sh
poetry install
```

---

## Go Setup
Ensure dependencies are tidy:
```sh
go mod tidy
```

---

## Running Turbo
```sh
turbo build
turbo dev
```

