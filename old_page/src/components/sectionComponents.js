import { Box, Heading } from '@primer/react'

export const TitleSection = ({ title, subtitle }) => <Box borderWidth="1px" borderStyle="solid" borderColor="border.default" borderRadius={2} className="color-bg-subtle" p={2}>
    <h3>{title}</h3>
    <h5 className='color-fg-muted'>Zuletzt aktualisiert: {subtitle} Uhr</h5>
</Box>;