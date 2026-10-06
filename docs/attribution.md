# Attribution and dependencies

This personal project implements mechanics researched from a published game designed by **Wolfgang Kramer and Michael Kiesling**, published by **ABACUSSPIELE** and **Capstone Games**. 

**Cascading Castles** artwork includes original code-generated woodland scenery, geometric stone turrets, custom vector heraldry, and original AI-generated board landscapes, card illustrations and medieval animal portraits. The requested cue is expressed as a general medieval woodland mood; no text, characters, insignia, or illustrations from other properties are included. Runtime artwork is saved in `public/art`.

Runtime libraries:

The selected board and generated portraits are integrated into live play. Four original transparent animal figures are saved in `public/art/units`. Stone textures, raven marks, bases and turret geometry are original code-generated assets. Animal figures are painted alpha planes on 3D bases.

Six movement illustrations, eight spell illustrations and one reverse are saved in `public/art/cards/revision-05`. Browser-typeset exports in its `faces` directory provide all 23 movement faces, eight spells and the reverse with exact rule values. Duplicate physical cards reuse their corresponding face.

- [React](https://github.com/facebook/react/blob/main/LICENSE): MIT.
- [Three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE): MIT.

Build/test tooling uses Vite, TypeScript, Vitest, and their transitive dependencies. Installed packages retain their own license notices in their distributions. The lockfile pins resolved versions. Research-only PDF rendering packages live in ignored `.tools/` and are not runtime dependencies or deployed assets.

The repository is marked private in package metadata and no license granting redistribution of the project is assigned. A GitHub Pages deployment may be accessible by URL depending on the GitHub account's available site visibility; this project currently has no remote or deployment.
