import test from "node:test";
import assert from "node:assert/strict";
import { distribute, ideaRoom } from "../app/venue/grouping.ts";
const make = (id, tag, group = "lobby") => ({
  id,
  name: id,
  skills: "",
  tag,
  group,
});
for (const mode of ["balanced", "random", "alphabetical"])
  test(
    mode +
      " distributes each selected role evenly and preserves other participants",
    () => {
      const rows = [
        make("Zoe", "idea"),
        make("Ada", "idea"),
        make("Solo", "open"),
        ...["F", "E", "D", "C", "B"].map((id) => make(id, "builder")),
        ...["S3", "S2", "S1"].map((id) => make(id, "seller")),
      ];
      const result = distribute(
        rows,
        new Set(rows.filter((x) => x.id !== "Solo").map((x) => x.id)),
        mode,
      );
      const groups = ["Zoe", "Ada"].map((id) =>
        result.filter((x) => x.group === ideaRoom(id)),
      );
      for (const g of groups)
        assert.equal(g.filter((x) => x.tag === "idea").length, 1);
      for (const tag of ["builder", "seller"])
        assert.ok(
          Math.abs(
            groups[0].filter((x) => x.tag === tag).length -
              groups[1].filter((x) => x.tag === tag).length,
          ) <= 1,
        );
      assert.equal(result.find((x) => x.id === "Solo").group, "lobby");
      assert.ok(rows.every((x) => x.group === "lobby"));
      if (mode === "alphabetical")
        assert.equal(result.find((x) => x.id === "B").group, ideaRoom("Ada"));
    },
  );
test("fill an existing role shortage without moving fixed names", () => {
  const rows = [
    make("a", "idea", ideaRoom("a")),
    make("b", "idea", ideaRoom("b")),
    make("old", "builder", ideaRoom("a")),
    make("new", "builder"),
  ];
  assert.equal(
    distribute(rows, new Set(["new"]), "balanced").at(-1).group,
    ideaRoom("b"),
  );
  assert.throws(() =>
    distribute([make("new", "seller")], new Set(["new"]), "balanced"),
  );
});
