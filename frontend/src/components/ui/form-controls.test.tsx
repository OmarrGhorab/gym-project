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

  it("filters combobox options by their visible name email and role text", async () => {
    const user = userEvent.setup();
    renderForm(
      <FormSelect
        aria-label="User ID"
        name="user_id"
        options={[
          { label: "Omar Fawzy Ghorab (omarghorab05@gmail.com) - Captain", value: "21" },
          { label: "Ops Manager (operations.manager@gym.test) - Manager", value: "22" },
          { label: "Ramy Closing A (closing.cashier1@gym.test) - Cashier", value: "23" },
        ]}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "User ID" });
    await user.click(combobox);
    await user.type(combobox, "omar fawzy");

    expect(await screen.findByRole("option", { name: /Omar Fawzy Ghorab/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ops Manager/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ramy Closing A/ })).not.toBeInTheDocument();

    await user.clear(combobox);
    await user.type(combobox, "closing.cashier1");

    expect(await screen.findByRole("option", { name: /Ramy Closing A/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Omar Fawzy Ghorab/ })).not.toBeInTheDocument();
  });

  it("uses the calendar component instead of a native date input", () => {
    const { container } = renderForm(<FormDatePicker aria-label="Start date" name="starts_at" />);

    expect(screen.getByRole("button", { name: "Start date" })).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();
  });
});
