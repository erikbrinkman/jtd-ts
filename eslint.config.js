import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import spellcheck from "eslint-plugin-spellcheck";

export default tseslint.config(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: { spellcheck },
    rules: {
      "spellcheck/spell-checker": [
        "error",
        {
          identifiers: false,
          skipWords: [
            "schemas",
            "nullable",
            "uint8",
            "uint16",
            "uint32",
            "enum",
            "bool",
            "nullish",
            "oprops",
          ],
          minLength: 4,
        },
      ],
    },
  }
);
