package models

import (
	"time"
)

// Feeling struct
type Feeling struct {
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	Comment   string    `json:"comment"`
}
