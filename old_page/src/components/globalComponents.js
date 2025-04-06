import { Header, Octicon, Avatar} from '@primer/react'

export default function GlobalHeader() {
    return (
        <Header>
            <Header.Item>
                <Header.Link
                    href="#"
                    sx={{
                        fontSize: 2,
                    }}
                >
                    {/* <Octicon
                        icon={MarkGithubIcon}
                        size={32}
                        sx={{
                            mr: 2,
                        }}
                    /> */}
                    <span>Testing</span>
                </Header.Link>
            </Header.Item>
            <Header.Item full>Rangliste</Header.Item>
            <Header.Item full>Bericht</Header.Item>
            <Header.Item full>1234</Header.Item>
            <Header.Item full>Test</Header.Item>
            <Header.Item
                sx={{
                    mr: 0,
                }}
            >
                <Avatar
                    src="https://github.com/octocat.png"
                    size={20}
                    square
                    alt="@octocat"
                />
            </Header.Item>
        </Header>
    )
}