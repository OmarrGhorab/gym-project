import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./select";

/**
 * Base UI renders the raw value in the trigger unless the root receives `items`.
 * Our <Select> derives those from the declared <SelectItem>s, so a trigger must
 * never show an id or a code where a human-readable label exists.
 */
describe("Select trigger labelling", () => {
  it("shows the item label, not the id, for id-valued items", () => {
    const products = [
      { id: 1, name: "Whey Protein" },
      { id: 2, name: "Creatine" },
    ];

    render(
      <Select defaultValue="1">
        <SelectTrigger>
          <SelectValue placeholder="Select product" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {products.map((product) => (
              <SelectItem key={product.id} value={String(product.id)}>
                {product.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Whey Protein")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows the label, not the code, for constant-valued items", () => {
    render(
      <Select defaultValue="bank_transfer">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.queryByText("bank_transfer")).not.toBeInTheDocument();
  });

  it("lets an explicit SelectValue children function win", () => {
    render(
      <Select defaultValue="7">
        <SelectTrigger>
          <SelectValue>{(value) => `Coach #${String(value)}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Sara Coach</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Coach #7")).toBeInTheDocument();
  });

  it("still renders the placeholder when nothing is selected", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Whey Protein</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Select product")).toBeInTheDocument();
  });
});
