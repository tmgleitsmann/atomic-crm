import type { Meta } from "@storybook/react-vite";
import { ResourceContextProvider } from "ra-core";

import DealList from "./DealList";

import {
  StoryWrapper,
  buildCompany,
  buildDeal,
  buildSale,
} from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Deals/Deal List",
  excludeStories: ["dataForCompanyFilter"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const dataForAccountManagerFilter = {
  companies: [buildCompany()],
  deals: [
    buildDeal({ id: 1, name: "Jane deal", sales_id: 0 }),
    buildDeal({ id: 2, index: 1, name: "Marie deal", sales_id: 1 }),
  ],
  sales: [
    buildSale({ administrator: true, first_name: "Jane", id: 0 }),
    buildSale({
      administrator: false,
      email: "mariecurie@atomic.dev",
      first_name: "Marie",
      id: 1,
      last_name: "Curie",
      user_id: "1",
    }),
  ],
};

export const AdminAccountManagerFilter = () => (
  <StoryWrapper data={dataForAccountManagerFilter}>
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const NonAdminAccountManagerFilter = () => (
  <StoryWrapper
    authProvider={{
      canAccess: async ({ resource }) => resource !== "sales",
    }}
    data={dataForAccountManagerFilter}
  >
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);

export const dataForCompanyFilter = {
  companies: [
    buildCompany({ id: 0, name: "Zero" }),
    buildCompany({ id: 1, name: "Alpha" }),
    buildCompany({ id: 2, name: "Beta" }),
    buildCompany({ id: 3, name: "Gamma" }),
  ],
  deals: [
    buildDeal({ id: 1, name: "Alpha opportunity", company_id: 1 }),
    buildDeal({
      id: 2,
      name: "Alpha proposal",
      company_id: 1,
      stage: "proposal-sent",
      sales_id: 1,
    }),
    buildDeal({ id: 3, name: "Beta opportunity", company_id: 2 }),
    buildDeal({
      id: 4,
      name: "Beta proposal",
      company_id: 2,
      stage: "proposal-sent",
      sales_id: 1,
    }),
    buildDeal({
      id: 5,
      name: "Archived Gamma deal",
      company_id: 3,
      archived_at: "2025-02-01T09:00:00.000Z",
    }),
  ],
  sales: [
    buildSale({ id: 0, first_name: "Alex", last_name: "Example" }),
    buildSale({ id: 1, first_name: "Blair", last_name: "Example" }),
  ],
};

export const CompanyFilter = () => (
  <StoryWrapper data={dataForCompanyFilter}>
    <ResourceContextProvider value="deals">
      <DealList />
    </ResourceContextProvider>
  </StoryWrapper>
);
