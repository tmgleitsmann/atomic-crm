import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { StrictMode } from "react";
import { memoryStore, useRefresh, type Store } from "ra-core";
import { MemoryRouter, useLocation } from "react-router";
import cloneDeep from "lodash/cloneDeep";

import { DataImportProvider } from "../dataImport/DataImportProvider";
import { createDataProvider } from "../providers/fakerest";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { CRM, type CRMProps } from "../root/CRM";
import { createCrmDb, createTestAuthProvider } from "@/test/StoryWrapper";

import {
  AdminAccountManagerFilter,
  dataForCompanyFilter,
  NonAdminAccountManagerFilter,
} from "./DealList.stories";

describe("DealList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lets an admin filter the board by account manager instead of only-mine", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Marie deal")).toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect.element(screen.getByText("Jane deal")).not.toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear value" });
    await clearButton.element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Marie deal")).toBeVisible();
  });

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });
});

const authProvider = createTestAuthProvider();
const TestLayout: CRMProps["layout"] = ({ children }) => {
  const location = useLocation();
  const refresh = useRefresh();
  return (
    <DataImportProvider>
      <output data-testid="location">{location.search}</output>
      <button onClick={refresh}>Refetch board</button>
      {children}
    </DataImportProvider>
  );
};

const BoardHarness = ({
  store,
  dataProvider,
  initialEntry = "/deals",
}: {
  store: Store;
  dataProvider: ReturnType<typeof createDataProvider>;
  initialEntry?: string;
}) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    <CRM
      authProvider={authProvider}
      dataProvider={dataProvider}
      i18nProvider={testI18nProvider}
      store={store}
      layout={TestLayout}
      disableTelemetry
    />
  </MemoryRouter>
);

const createHarnessProps = (listParams?: object) => {
  const dataProvider = createDataProvider({
    db: createCrmDb(cloneDeep(dataForCompanyFilter)),
    silent: true,
  });
  const getList = vi.spyOn(dataProvider, "getList");
  const getMany = vi.spyOn(dataProvider, "getMany");
  const store = memoryStore(
    listParams ? { "deals.listParams": listParams } : {},
  );
  return { dataProvider, store, getList, getMany };
};

const companyInput = () => page.getByRole("combobox", { name: "Company" });
const selectCompany = async (name: string) => {
  await companyInput().click();
  await page.getByRole("option", { name, exact: true }).click();
};
const urlFilters = () =>
  JSON.parse(
    new URLSearchParams(
      page.getByTestId("location").element().textContent ?? "",
    ).get("filter") ?? "{}",
  );
const activeRequests = (
  getList: ReturnType<typeof createHarnessProps>["getList"],
) =>
  getList.mock.calls.filter(
    ([resource, params]) =>
      resource === "deals" && params.filter["archived_at@is"] === null,
  );

describe("DealList company filter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows Company above the board by default, filters across stages, and clears with All", async () => {
    const props = createHarnessProps();
    await render(<BoardHarness {...props} />);
    await expect.element(companyInput()).toHaveTextContent("All");
    await expect.element(page.getByText("Alpha opportunity")).toBeVisible();
    expect(
      companyInput().element().getBoundingClientRect().bottom,
    ).toBeLessThan(
      page
        .getByRole("heading", { name: "Opportunity", exact: true })
        .element()
        .getBoundingClientRect().top,
    );
    await page.getByRole("button", { name: "Add filter" }).click();
    await expect
      .element(page.getByRole("menuitem", { name: "Company", exact: true }))
      .not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await selectCompany("Alpha");
    await expect.element(page.getByText("Alpha proposal")).toBeVisible();
    await expect
      .element(page.getByText("Beta opportunity"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Beta proposal"))
      .not.toBeInTheDocument();
    expect(activeRequests(props.getList).at(-1)?.[1]).toMatchObject({
      filter: { company_id: 1, "archived_at@is": null },
      pagination: { perPage: 100 },
    });

    await selectCompany("Beta");
    await expect.element(page.getByText("Beta opportunity")).toBeVisible();
    await expect.element(page.getByText("Beta proposal")).toBeVisible();
    await expect
      .element(page.getByText("Alpha opportunity"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Alpha proposal"))
      .not.toBeInTheDocument();
    expect(activeRequests(props.getList).at(-1)?.[1].filter.company_id).toBe(2);

    await companyInput().click();
    await expect
      .element(page.getByRole("option", { name: "All", exact: true }))
      .toBeVisible();
    await userEvent.keyboard("{Home}");
    await expect
      .element(page.getByRole("option", { name: "All", exact: true }))
      .toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(companyInput()).toHaveTextContent("All");
    await expect.element(page.getByText("Alpha opportunity")).toBeVisible();
    await expect.element(page.getByText("Beta proposal")).toBeVisible();
    await expect.poll(() => urlFilters()).not.toHaveProperty("company_id");
    await page.getByRole("button", { name: "Refetch board" }).click();
    await expect
      .poll(() => activeRequests(props.getList).at(-1)?.[1].filter)
      .toEqual({ "archived_at@is": null });
    expect(
      props.getMany.mock.calls
        .filter(([resource]) => resource === "companies")
        .flatMap(([, params]) => params.ids)
        .every((id) => typeof id === "number"),
    ).toBe(true);
  });

  it("preserves account manager and search restrictions when clearing Company", async () => {
    const props = createHarnessProps();
    await render(<BoardHarness {...props} />);
    await page.getByRole("combobox", { name: "Account manager" }).click();
    await page.getByRole("option", { name: "Blair Example" }).click();
    await page.getByPlaceholder("Search", { exact: true }).fill("proposal");
    await selectCompany("Alpha");
    await expect.element(page.getByText("Alpha proposal")).toBeVisible();
    await expect
      .element(page.getByText("Beta proposal"))
      .not.toBeInTheDocument();
    await selectCompany("All");
    await expect.element(page.getByText("Beta proposal")).toBeVisible();
    await expect
      .element(page.getByText("Alpha opportunity"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Beta opportunity"))
      .not.toBeInTheDocument();
    await expect
      .poll(() => urlFilters())
      .toEqual({ sales_id: 1, q: "proposal" });
  });

  it("keeps empty stage columns and the selector usable for a company with no active deals", async () => {
    await render(<BoardHarness {...createHarnessProps()} />);
    await expect.element(page.getByText("Alpha opportunity")).toBeVisible();
    await selectCompany("Gamma");
    await expect
      .element(page.getByText("Alpha opportunity"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Beta proposal"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Archived Gamma deal"))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Opportunity", exact: true }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole("heading", { name: "Proposal Sent", exact: true }),
      )
      .toBeVisible();
    await selectCompany("All");
    await expect.element(page.getByText("Alpha opportunity")).toBeVisible();
    await expect.element(page.getByText("Beta proposal")).toBeVisible();
    await expect
      .element(page.getByText("Archived Gamma deal"))
      .not.toBeInTheDocument();
  });

  it.each(["store", "url"])(
    "resets a real saved selection on a fresh mount from %s and retains other filters",
    async (source) => {
      const props = createHarnessProps();
      const first = await render(<BoardHarness {...props} />);
      await page.getByRole("combobox", { name: "Account manager" }).click();
      await page.getByRole("option", { name: "Blair Example" }).click();
      await selectCompany("Alpha");
      await expect
        .poll(() => props.store.getItem("deals.listParams").filter)
        .toEqual({ company_id: 1, sales_id: 1 });
      await expect
        .poll(() => urlFilters())
        .toEqual({ company_id: 1, sales_id: 1 });
      const savedParams = cloneDeep(props.store.getItem("deals.listParams"));
      const savedSearch = page.getByTestId("location").element().textContent;
      await first.unmount();

      const restored = createHarnessProps(
        source === "store"
          ? savedParams
          : { ...savedParams, filter: { company_id: 2, sales_id: 0 } },
      );
      await render(
        <BoardHarness
          {...restored}
          initialEntry={source === "url" ? `/deals${savedSearch}` : "/deals"}
        />,
      );
      await expect.element(companyInput()).toHaveTextContent("All");
      await expect.element(page.getByText("Alpha proposal")).toBeVisible();
      await expect.element(page.getByText("Beta proposal")).toBeVisible();
      await expect
        .element(page.getByText("Alpha opportunity"))
        .not.toBeInTheDocument();
      await expect
        .poll(() => restored.store.getItem("deals.listParams").filter)
        .toEqual({ sales_id: 1 });
      await expect.poll(() => urlFilters()).toEqual({ sales_id: 1 });
    },
  );

  it("removes a seeded zero company id and retains category and displayed filters", async () => {
    const props = createHarnessProps({
      filter: { company_id: 0, category: "Other" },
      displayedFilters: { category: true },
      page: 1,
      perPage: 100,
      sort: "index",
      order: "DESC",
    });
    await render(<BoardHarness {...props} />);
    await expect.element(companyInput()).toHaveTextContent("All");
    await expect
      .poll(() => props.store.getItem("deals.listParams"))
      .toMatchObject({
        filter: { category: "Other" },
        displayedFilters: { category: true },
      });
    await expect.poll(() => urlFilters()).toEqual({ category: "Other" });
    await selectCompany("Alpha");
    await expect
      .poll(() => urlFilters())
      .toEqual({ company_id: 1, category: "Other" });
    await selectCompany("All");
    await expect.poll(() => urlFilters()).toEqual({ category: "Other" });
  });

  it("does not reset later choices on rerender or refetch, including StrictMode", async () => {
    const props = createHarnessProps({
      filter: { company_id: 1 },
      page: 1,
      perPage: 100,
      sort: "index",
      order: "DESC",
    });
    const screen = await render(
      <StrictMode>
        <BoardHarness {...props} />
      </StrictMode>,
    );
    await expect.element(companyInput()).toHaveTextContent("All");
    await selectCompany("Beta");
    await expect
      .element(page.getByText("Alpha opportunity"))
      .not.toBeInTheDocument();
    await expect.poll(() => urlFilters()).toEqual({ company_id: 2 });
    await screen.rerender(
      <StrictMode>
        <BoardHarness {...props} />
      </StrictMode>,
    );
    const beforeRefetch = activeRequests(props.getList).length;
    await page.getByRole("button", { name: "Refetch board" }).click();
    await expect
      .poll(() => activeRequests(props.getList).length)
      .toBeGreaterThan(beforeRefetch);
    await expect.element(companyInput()).toHaveTextContent("Beta");
    await expect.poll(() => urlFilters()).toEqual({ company_id: 2 });
    await expect.element(page.getByText("Beta proposal")).toBeVisible();
    await expect
      .element(page.getByText("Alpha opportunity"))
      .not.toBeInTheDocument();
  });
});
