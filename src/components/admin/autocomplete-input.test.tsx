import {
  CoreAdminContext,
  Form,
  required,
  testDataProvider,
  type DataProvider,
  type GetListParams,
} from "ra-core";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { AutocompleteInput } from "./autocomplete-input";
import { ReferenceInput } from "./reference-input";

const choices = [
  { id: 0, name: "Zero" },
  { id: 2, name: "Two" },
];

describe("AutocompleteInput empty option", () => {
  it("translates the empty label and clears a numeric zero with the keyboard", async () => {
    const onChange = vi.fn();
    await render(
      <CoreAdminContext i18nProvider={testI18nProvider}>
        <Form onSubmit={() => undefined} defaultValues={{ company_id: 0 }}>
          <AutocompleteInput
            source="company_id"
            label="Company"
            choices={choices}
            emptyText="resources.deals.filters.all_companies"
            onChange={onChange}
          />
        </Form>
      </CoreAdminContext>,
    );
    const input = page.getByRole("combobox", { name: "Company" });
    await expect.element(input).toHaveTextContent("Zero");
    await input.click();
    await expect
      .element(page.getByRole("option", { name: "All", exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Home}");
    await expect
      .element(page.getByRole("option", { name: "All", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(input).toHaveTextContent("All");
    await expect.poll(() => onChange.mock.lastCall?.[0]).toBe("");
    await expect
      .element(page.getByRole("option", { name: "All", exact: true }))
      .not.toBeInTheDocument();
  });

  it("keeps All available when reference search returns no matches and clears search", async () => {
    const getList = vi.fn(async (_resource: string, params: GetListParams) => ({
      data: params.filter.q ? [] : choices,
      total: params.filter.q ? 0 : choices.length,
    }));
    await render(
      <CoreAdminContext
        i18nProvider={testI18nProvider}
        dataProvider={testDataProvider({
          getList: getList as DataProvider["getList"],
        })}
      >
        <Form onSubmit={() => undefined}>
          <ReferenceInput source="company_id" reference="companies">
            <AutocompleteInput
              label="Company"
              optionText="name"
              emptyText="All"
            />
          </ReferenceInput>
        </Form>
      </CoreAdminContext>,
    );
    const input = page.getByRole("combobox", { name: "Company" });
    await input.click();
    await page
      .getByPlaceholder("Search...", { exact: true })
      .fill("no matches");
    await expect
      .poll(() =>
        getList.mock.calls.some(
          ([, params]) => params.filter.q === "no matches",
        ),
      )
      .toBe(true);
    await expect
      .element(page.getByRole("option", { name: "Two", exact: true }))
      .not.toBeInTheDocument();
    await page.getByRole("option", { name: "All", exact: true }).click();
    await input.click();
    await expect
      .element(page.getByPlaceholder("Search...", { exact: true }))
      .toHaveValue("");
    await expect
      .element(page.getByRole("option", { name: "Two", exact: true }))
      .toBeVisible();
  });

  it.each([false, true])(
    "does not add an empty option when omitted or required (required: %s)",
    async (isRequired) => {
      await render(
        <CoreAdminContext>
          <Form onSubmit={() => undefined}>
            <AutocompleteInput
              source="company_id"
              label="Company"
              choices={choices}
              emptyText={isRequired ? "All" : undefined}
              validate={isRequired ? required() : undefined}
            />
          </Form>
        </CoreAdminContext>,
      );
      await page.getByRole("combobox", { name: /Company/ }).click();
      await expect
        .element(page.getByRole("option", { name: "Two", exact: true }))
        .toBeVisible();
      await expect
        .element(page.getByRole("option", { name: "All", exact: true }))
        .not.toBeInTheDocument();
    },
  );

  it.each([undefined, "All"])(
    "preserves create suggestions with emptyText=%s",
    async (emptyText) => {
      const onCreate = vi.fn(async () => ({ id: 3, name: "Three" }));
      const onChange = vi.fn();
      await render(
        <CoreAdminContext i18nProvider={testI18nProvider}>
          <Form onSubmit={() => undefined}>
            <AutocompleteInput
              source="company_id"
              label="Company"
              choices={choices}
              emptyText={emptyText}
              onCreate={onCreate}
              onChange={onChange}
            />
          </Form>
        </CoreAdminContext>,
      );
      await page.getByRole("combobox", { name: "Company" }).click();
      await page.getByPlaceholder("Search...", { exact: true }).fill("Three");
      if (emptyText) {
        await expect
          .element(page.getByRole("option", { name: "All", exact: true }))
          .toBeVisible();
      }
      await page.getByRole("option", { name: "Create", exact: true }).click();
      await expect.poll(() => onCreate.mock.calls.length).toBe(1);
      await expect.poll(() => onChange.mock.lastCall?.[0]).toBe(3);
    },
  );
});
