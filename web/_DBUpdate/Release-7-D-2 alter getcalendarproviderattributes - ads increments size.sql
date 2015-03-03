SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROC [dbo].[GetUserCalendarProviderAttributes]

@UserID int


as

SELECT AdvanceTime,MinTime,MaxTime,BetweenTime,UseCalendarProgram,CalendarType,CalendarURL, PrivateCalendarToken, IncrementsSizeInMinutes
FROM CalendarProviderAttributes
WHERE UserID = @UserID

