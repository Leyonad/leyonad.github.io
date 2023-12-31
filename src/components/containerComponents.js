import { Box, Heading } from '@primer/react'

export const Section = ({ text, content: ContentComponent }) => {
    return (
        <>
            <Box borderWidth="1px" borderStyle="solid" borderColor="border.default" borderRadius={2} p={2}>
                <Heading sx={{ mb: 2 }}>{text}</Heading>
                <ContentComponent />
            </Box>
        </>
    )
}