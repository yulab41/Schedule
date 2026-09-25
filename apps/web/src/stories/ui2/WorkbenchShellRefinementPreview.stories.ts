import type { Meta, StoryObj } from '@storybook/vue3-vite';

import WorkbenchShellRefinementPreview from './WorkbenchShellRefinementPreview.vue';

const meta = {
  title: 'Web UI 2.0/Shell Refinement Preview',
  component: WorkbenchShellRefinementPreview,
  tags: ['autodocs'],
  args: {
    layout: 'mobile',
    largeText: false,
    longGroupName: false,
    screen: 'calendar',
  },
  argTypes: {
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    largeText: { control: 'boolean' },
    longGroupName: { control: 'boolean' },
    openGroupMenu: { control: 'boolean' },
    profileEditor: { control: 'radio', options: ['none', 'mobile', 'short'] },
    qrPreview: { control: 'boolean' },
    screen: {
      control: 'radio',
      options: ['calendar', 'directory', 'swap', 'profile', 'more', 'login'],
    },
  },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof WorkbenchShellRefinementPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Calendar390: Story = {
  name: '1 · 390px 完整月历',
};

export const LongGroupName320: Story = {
  name: '2 · 320px 长群组名称',
  args: { longGroupName: true },
  globals: { viewport: 'mobile320' },
};

export const GroupMenuOpen390: Story = {
  name: '3 · 390px 群组菜单展开',
  args: { openGroupMenu: true },
};

export const Swap390: Story = {
  name: '4 · 390px 换班',
  args: { screen: 'swap' },
};

export const Directory390: Story = {
  name: '5 · 390px 通讯录',
  args: { screen: 'directory' },
};

export const Profile390: Story = {
  name: '6 · 390px 我的',
  args: { screen: 'profile' },
};

export const ProfileMobileEditor390: Story = {
  name: '7 · 390px 修改手机号弹窗',
  args: { profileEditor: 'mobile', screen: 'profile' },
};

export const ProfileShortEditor390: Story = {
  name: '8 · 390px 修改短号弹窗',
  args: { profileEditor: 'short', screen: 'profile' },
};

export const More390: Story = {
  name: '9 · 390px 更多',
  args: { screen: 'more' },
};

export const MemberQr390: Story = {
  name: '10 · 390px 成员二维码四字段',
  args: { qrPreview: true, screen: 'more' },
};

export const LargeText390: Story = {
  name: '11 · 390px 大字体',
  args: { largeText: true, screen: 'profile' },
};

export const LoginFooter390: Story = {
  name: '12 · 390px 登录页融入式页脚',
  args: { screen: 'login' },
};

export const Desktop1280: Story = {
  name: '13 · 1280px 紧凑工作台',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
