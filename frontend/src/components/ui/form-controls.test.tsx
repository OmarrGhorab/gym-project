import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { FormDatePicker, FormSelect } from "./form-controls";

const messages = {
  Dashboard: {
    formControls: {
      noResults: "No results found.",
      selectDate: "Select date",
      selectOption: "Select an option",
    },
  },
};

function renderForm(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <form>{children}</form>
    </NextIntlClientProvider>,
  );
}

describe("form controls", () => {
  it("submits a selected Base UI combobox option", async () => {
    const user = userEvent.setup();
    const { container } = renderForm(
      <FormSelect
        aria-label="Membership plan"
        name="plan"
        options={[
          { label: "Basic", value: "basic" },
          { label: "Premium", value: "premium" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Membership plan" }));
    await user.click(await screen.findByRole("option", { name: "Premium" }));

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(new FormData(form as HTMLFormElement).get("plan")).toBe("premium");
  });

  it("uses the calendar component instead of a native date input", () => {
    const { container } = renderForm(<FormDatePicker aria-label="Start date" name="starts_at" />);

    expect(screen.getByRole("button", { name: "Start date" })).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();
  });
});
